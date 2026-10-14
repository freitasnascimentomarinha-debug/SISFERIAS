// Importação e exportação de dados.
//
// Aceita:
//  - o arquivo de backup do próprio SISFERIAS (.json, gerado em "Exportar");
//  - CSVs, um por tabela, com os nomes das colunas na primeira linha;
//  - um CSV de usuários (id, email, password_hash ou encrypted_password)
//    que preserva as senhas dos usuários (hash bcrypt).
//
// O fluxo é sempre: preview (nada é gravado) -> apply (tudo em uma transação).

import { db, toDb, newId, nowIso, upsertRow, transaction } from './db.js';
import { TABLES, TABLE_ORDER } from './schema.js';
import { createBackup } from './backup.js';

export const AUTH_USERS = 'auth_users';
const AUTH_COLUMNS = ['id', 'email', 'encrypted_password', 'password_hash', 'created_at'];
const TIMESTAMP_COLUMNS = new Set(['created_at', 'updated_at', 'timestamp']);

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function detectDelimiter(text) {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  let inQuotes = false;
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ',';
}

export function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const records = [];
  let field = '';
  let record = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { record.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field); field = '';
      if (record.length > 1 || record[0] !== '') records.push(record);
      record = [];
    } else field += ch;
  }
  if (field !== '' || record.length) { record.push(field); records.push(record); }

  const [header = [], ...rows] = records;
  const columns = header.map(h => h.trim());
  return rows.map(values => {
    const obj = {};
    columns.forEach((col, idx) => { obj[col] = values[idx] ?? ''; });
    return obj;
  });
}

function toCsv(rows) {
  if (!rows.length) return '';
  const columns = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map(r => columns.map(c => esc(r[c])).join(','))].join('\r\n');
}

// ---------------------------------------------------------------------------
// Identificação das tabelas
// ---------------------------------------------------------------------------

function detectTable(fileName, sampleRow) {
  const name = fileName.toLowerCase();
  const headers = Object.keys(sampleRow || {});
  if (headers.includes('encrypted_password') || headers.includes('password_hash')) return AUTH_USERS;
  // Nome do arquivo: "employees_rows.csv", "profiles.csv"...
  const byName = Object.keys(TABLES)
    .filter(t => name.includes(t))
    .sort((a, b) => b.length - a.length)[0];
  if (byName) return byName;
  if (/(^|[^a-z])users/.test(name) && headers.includes('email') && !headers.includes('role')) return AUTH_USERS;
  // Pelas colunas: tabela com maior número de colunas em comum.
  let best = null;
  let bestScore = 0;
  for (const [table, spec] of Object.entries(TABLES)) {
    const score = headers.filter(h => h in spec.columns).length / Object.keys(spec.columns).length;
    if (score > bestScore) { best = table; bestScore = score; }
  }
  return bestScore >= 0.5 ? best : null;
}

/** Lê os arquivos enviados e agrupa as linhas por tabela. */
function readFiles(files, overrides = {}) {
  const sources = []; // { file, table, rows }
  const problems = [];

  for (const file of files) {
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith('.json')) {
        const parsed = JSON.parse(file.content);
        if (parsed && parsed.format === 'sisferias-backup' && parsed.tables) {
          for (const [table, rows] of Object.entries(parsed.tables)) {
            if (table in TABLES && Array.isArray(rows)) sources.push({ file: file.name, table, rows });
          }
          if (Array.isArray(parsed.auth_users)) sources.push({ file: file.name, table: AUTH_USERS, rows: parsed.auth_users });
          continue;
        }
        const rows = Array.isArray(parsed) ? parsed : null;
        if (!rows) throw new Error('JSON não reconhecido (esperado backup do SISFERIAS ou lista de registros).');
        const table = overrides[file.name] || detectTable(file.name, rows[0]);
        sources.push({ file: file.name, table, rows });
      } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        const rows = parseCsv(file.content);
        const table = overrides[file.name] || detectTable(file.name, rows[0]);
        sources.push({ file: file.name, table, rows });
      } else {
        throw new Error('Formato não suportado. Use .csv ou .json.');
      }
    } catch (err) {
      problems.push({ file: file.name, error: err.message });
    }
  }
  return { sources, problems };
}

// ---------------------------------------------------------------------------
// Normalização das linhas
// ---------------------------------------------------------------------------

function normalizeTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value)) return value;
  let v = value.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

/** Converte uma linha importada no formato do banco. Lança erro se inválida. */
function prepareRow(table, raw) {
  const spec = TABLES[table];
  const data = {};
  const extra = {};
  for (const [col, value] of Object.entries(raw)) {
    if (col === 'extra_json') {
      if (value) Object.assign(extra, typeof value === 'string' ? JSON.parse(value) : value);
      continue;
    }
    if (!(col in spec.columns)) {
      if (value !== '' && value !== null && value !== undefined) extra[col] = value;
      continue;
    }
    // Vazio = sem valor: o banco aplica o padrão da coluna.
    if (value === '' || value === null || value === undefined) continue;
    const type = spec.columns[col];
    let v = TIMESTAMP_COLUMNS.has(col) ? normalizeTimestamp(value) : value;
    try {
      toDb(type, v);
    } catch {
      throw new Error(`coluna "${col}" não contém JSON válido`);
    }
    data[col] = v;
  }

  for (const key of spec.key) {
    if (data[key] === undefined) {
      if (table === 'system_settings') data.id = 1;
      else if (key === 'id') data.id = newId();
      else throw new Error(`coluna obrigatória "${key}" está vazia`);
    }
  }
  if (table === 'profiles' && data.role && !['admin', 'user'].includes(data.role)) {
    throw new Error(`papel inválido "${data.role}" (use admin ou user)`);
  }
  if (table === 'employees' && data.vacation_parcels !== undefined) {
    const parcels = typeof data.vacation_parcels === 'string' ? JSON.parse(data.vacation_parcels) : data.vacation_parcels;
    if (!Array.isArray(parcels)) throw new Error('"vacation_parcels" deve ser uma lista de parcelas');
  }
  return { data, extra };
}

function prepareAuthRow(raw) {
  const id = raw.id?.trim();
  const email = raw.email?.trim();
  if (!id) throw new Error('coluna obrigatória "id" está vazia');
  if (!email) throw new Error('coluna obrigatória "email" está vazia');
  const hash = (raw.password_hash || raw.encrypted_password || '').trim() || null;
  if (hash && !/^\$2[aby]\$\d{2}\$/.test(hash)) throw new Error('senha não está no formato bcrypt');
  return { id, email, password_hash: hash, created_at: normalizeTimestamp(raw.created_at) || nowIso() };
}

function exists(table, data) {
  const spec = TABLES[table];
  return !!db.prepare(`SELECT 1 FROM ${table} WHERE ${spec.key.map(k => `"${k}" = ?`).join(' AND ')}`)
    .get(...spec.key.map(k => String(data[k])));
}

// ---------------------------------------------------------------------------
// Análise (preview) e aplicação
// ---------------------------------------------------------------------------

function analyze(files, overrides) {
  const { sources, problems } = readFiles(files, overrides);
  const report = {
    files: [],
    tables: {},
    problems,
    warnings: [],
  };
  const plan = []; // { table, data, extra, action }

  const tableReport = (table) => {
    if (!report.tables[table]) {
      report.tables[table] = {
        table,
        label: table === AUTH_USERS ? 'Usuários e senhas' : TABLES[table].label,
        total: 0, insert: 0, update: 0, errors: [], unmappedColumns: [],
      };
    }
    return report.tables[table];
  };

  const seenEmployeeKeys = new Map();
  const authIdsInFile = new Set();
  const authEmailsInFile = new Map();

  // Processa na ordem das dependências.
  const order = [AUTH_USERS, ...TABLE_ORDER];
  sources.sort((a, b) => order.indexOf(a.table) - order.indexOf(b.table));

  for (const source of sources) {
    report.files.push({ file: source.file, table: source.table, rows: source.rows.length });
    if (!source.table) {
      problems.push({ file: source.file, error: 'Não foi possível identificar a tabela. Escolha manualmente.' });
      continue;
    }
    const tr = tableReport(source.table);
    const known = source.table === AUTH_USERS ? AUTH_COLUMNS : [...Object.keys(TABLES[source.table].columns), 'extra_json'];
    const unmapped = Object.keys(source.rows[0] || {}).filter(c => !known.includes(c));
    if (source.table === AUTH_USERS) {
      // Demais colunas do CSV de usuários (metadados) não são necessárias.
    } else {
      tr.unmappedColumns = [...new Set([...tr.unmappedColumns, ...unmapped])];
    }

    source.rows.forEach((raw, idx) => {
      tr.total += 1;
      const line = idx + 2; // linha 1 é o cabeçalho
      try {
        if (source.table === AUTH_USERS) {
          const row = prepareAuthRow(raw);
          const sameEmail = db.prepare('SELECT id FROM auth_users WHERE email = ?').get(row.email);
          if (sameEmail && sameEmail.id !== row.id) throw new Error(`e-mail ${row.email} já pertence a outra conta neste sistema`);
          const dupe = authEmailsInFile.get(row.email.toLowerCase());
          if (dupe && dupe !== row.id) throw new Error(`e-mail ${row.email} repetido no arquivo`);
          authEmailsInFile.set(row.email.toLowerCase(), row.id);
          authIdsInFile.add(row.id);
          const already = !!db.prepare('SELECT 1 FROM auth_users WHERE id = ?').get(row.id);
          tr[already ? 'update' : 'insert'] += 1;
          plan.push({ table: AUTH_USERS, data: row });
          return;
        }

        const { data, extra } = prepareRow(source.table, raw);
        if (source.table === 'employees' && data.user_id && data.planning_year) {
          const k = `${data.user_id}|${parseInt(data.planning_year, 10)}`;
          const other = db.prepare('SELECT id FROM employees WHERE user_id = ? AND planning_year = ?')
            .get(data.user_id, parseInt(data.planning_year, 10));
          if (other && other.id !== data.id) throw new Error(`já existe outro lançamento para este usuário no ano ${data.planning_year}`);
          if (seenEmployeeKeys.has(k) && seenEmployeeKeys.get(k) !== data.id) throw new Error(`lançamento repetido para o ano ${data.planning_year}`);
          seenEmployeeKeys.set(k, data.id);
        }
        const action = exists(source.table, data) ? 'update' : 'insert';
        tr[action] += 1;
        plan.push({ table: source.table, data, extra });
      } catch (err) {
        tr.errors.push({ file: source.file, line, error: err.message });
      }
    });
  }

  // Perfis sem senha correspondente: o usuário só entra após o admin definir uma senha.
  const profileRows = plan.filter(p => p.table === 'profiles');
  const withoutPassword = profileRows.filter(p => {
    if (authIdsInFile.has(p.data.id)) {
      const auth = plan.find(a => a.table === AUTH_USERS && a.data.id === p.data.id);
      return !auth?.data.password_hash;
    }
    const row = db.prepare('SELECT password_hash FROM auth_users WHERE id = ?').get(p.data.id);
    return !row?.password_hash;
  });
  if (withoutPassword.length) {
    report.warnings.push(
      `${withoutPassword.length} perfil(is) ficará(ão) sem senha. Esses usuários só conseguirão entrar depois que um administrador definir uma senha em Segurança > Contas` +
      (authIdsInFile.size ? '.' : ' — ou importe também o CSV de usuários e senhas para manter as senhas atuais.'),
    );
  }
  for (const tr of Object.values(report.tables)) {
    if (tr.unmappedColumns.length) {
      report.warnings.push(`${tr.label}: colunas não previstas (${tr.unmappedColumns.join(', ')}) serão guardadas em "extra_json", sem perda.`);
    }
  }

  return { report, plan };
}

export function previewImport(files, overrides) {
  return analyze(files, overrides).report;
}

export function applyImport(files, overrides, { mode = 'merge' } = {}) {
  const { report, plan } = analyze(files, overrides);
  if (report.problems.length) {
    const err = new Error('Há arquivos com problemas. Corrija-os e gere a pré-visualização novamente.');
    err.report = report;
    throw err;
  }

  const backupFile = createBackup('antes-importacao');
  const before = countAll();

  transaction(() => {
    if (mode === 'replace') {
      // Substitui apenas as tabelas presentes na importação.
      const tables = new Set(plan.map(p => p.table));
      for (const table of [...TABLE_ORDER].reverse()) if (tables.has(table)) db.exec(`DELETE FROM ${table}`);
    }

    for (const item of plan) {
      if (item.table === AUTH_USERS) {
        db.prepare(`INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET email = excluded.email,
            password_hash = COALESCE(excluded.password_hash, auth_users.password_hash)`)
          .run(item.data.id, item.data.email, item.data.password_hash, item.data.created_at);
      } else {
        upsertRow(item.table, item.data, { extra: Object.keys(item.extra).length ? item.extra : undefined });
      }
    }

    // Garante uma conta de acesso (ainda sem senha) para cada perfil importado.
    const orphans = db.prepare(`SELECT p.id, p.email FROM profiles p
      LEFT JOIN auth_users a ON a.id = p.id WHERE a.id IS NULL AND p.email <> ''`).all();
    const insertAuth = db.prepare('INSERT OR IGNORE INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, NULL, ?)');
    for (const o of orphans) insertAuth.run(o.id, o.email, nowIso());
  });

  const after = countAll();
  return { report, backupFile, before, after };
}

export function countAll() {
  const counts = { auth_users: db.prepare('SELECT COUNT(*) c FROM auth_users').get().c };
  for (const t of TABLE_ORDER) counts[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  return counts;
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

function exportTableRows(table) {
  const spec = TABLES[table];
  return db.prepare(`SELECT * FROM ${table}`).all().map(row => {
    const out = {};
    for (const [col, type] of Object.entries(spec.columns)) {
      const v = row[col];
      out[col] = v === null ? null : type === 'bool' ? !!v : type === 'json' ? JSON.parse(v) : v;
    }
    if (row.extra_json) out.extra_json = JSON.parse(row.extra_json);
    return out;
  });
}

/** Backup completo em JSON, que pode ser reimportado em outro servidor. */
export function exportAll({ includePasswords = true } = {}) {
  const tables = {};
  for (const t of TABLE_ORDER) tables[t] = exportTableRows(t);
  const result = {
    format: 'sisferias-backup',
    version: 1,
    exported_at: nowIso(),
    tables,
  };
  if (includePasswords) {
    result.auth_users = db.prepare('SELECT id, email, password_hash, created_at FROM auth_users').all();
  }
  return result;
}

export function exportTableCsv(table) {
  return '﻿' + toCsv(exportTableRows(table));
}
