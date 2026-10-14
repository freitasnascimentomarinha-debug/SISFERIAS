// Acesso ao banco de dados PostgreSQL.
//
// - q / one / run executam SQL com parâmetros "?" (convertidos para $1, $2...).
// - transaction(fn) executa fn dentro de uma transação; todas as consultas
//   feitas dentro dela (mesmo em funções chamadas) usam a mesma conexão.
// - toDb / rowOut convertem valores entre a API e o banco, cifrando e
//   decifrando automaticamente as colunas com dados pessoais.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { TABLES, MIGRATIONS, APPEND_ONLY_TABLES } from './schema.js';
import { config } from './config.js';
import {
  encrypt, decrypt, blindIndex, hashPassword, passwordProblems, loadMasterKey, useMasterKey, keyFingerprint,
} from './crypto.js';

export const nowIso = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

// Datas/horas chegam como texto ISO 8601; contagens (bigint) como número.
pg.types.setTypeParser(1184, v => new Date(v).toISOString()); // timestamptz
pg.types.setTypeParser(1114, v => new Date(`${v}Z`).toISOString()); // timestamp
pg.types.setTypeParser(20, v => Number(v)); // bigint

let pool = null;
let embedded = null;
export const dbInfo = { mode: '', description: '', appRole: '', leastPrivilege: false };
const txStore = new AsyncLocalStorage();

const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };
const executor = () => {
  const client = txStore.getStore();
  if (client) return client;
  if (!pool) throw new Error('Banco de dados não conectado.');
  return pool;
};

/** Executa uma consulta e devolve as linhas. */
export async function q(sql, params = []) {
  return (await executor().query(toPg(sql), params)).rows;
}
/** Primeira linha da consulta (ou undefined). */
export async function one(sql, params = []) {
  return (await q(sql, params))[0];
}
/** Executa um comando e devolve o número de linhas afetadas. */
export async function run(sql, params = []) {
  return (await executor().query(toPg(sql), params)).rowCount;
}

/** Executa `fn` dentro de uma transação; desfaz tudo se houver erro. */
export async function transaction(fn) {
  if (txStore.getStore()) return fn(); // já dentro de uma transação
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await txStore.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Conversão de valores
// ---------------------------------------------------------------------------

const TRUE_VALUES = new Set(['true', 't', '1', 'sim', 's', 'yes', 'y']);

/** Converte um valor para o tipo lógico da coluna. Lança erro se inválido. */
export function toDbType(type, value) {
  if (value === undefined || value === null) return null;
  switch (type) {
    case 'bool':
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return !!value;
      return TRUE_VALUES.has(String(value).trim().toLowerCase());
    case 'int': {
      if (value === '') return null;
      const n = Number.parseInt(value, 10);
      return Number.isFinite(n) ? n : null;
    }
    case 'ts': {
      if (value === '') return null;
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) throw new Error(`data/hora inválida "${value}"`);
      return d.toISOString();
    }
    case 'json':
      if (typeof value === 'string') {
        if (value.trim() === '') return null;
        JSON.parse(value); // lança erro se o texto não for JSON válido
        return value;
      }
      return JSON.stringify(value);
    default:
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
  }
}

const isEncryptedCol = (table, col) => !!TABLES[table].encrypted?.includes(col);

/** Valor pronto para gravar na coluna (cifrado, se for dado pessoal). */
export function toDb(table, col, value) {
  const v = toDbType(TABLES[table].columns[col], value);
  return v !== null && isEncryptedCol(table, col) ? encrypt(String(v)) : v;
}

/** Valor lido do banco no formato da API (decifrado, se for dado pessoal). */
export function fromDb(table, col, value) {
  if (value === undefined || value === null) return null;
  const type = TABLES[table].columns[col];
  if (isEncryptedCol(table, col)) {
    const plain = decrypt(value);
    if (type === 'json') { try { return JSON.parse(plain); } catch { return null; } }
    if (type === 'int') return Number(plain);
    return plain;
  }
  if (type === 'json' && typeof value === 'string') { try { return JSON.parse(value); } catch { return null; } }
  if (type === 'bool') return !!value;
  return value;
}

/** Converte uma linha do banco para o formato da API. */
export function rowOut(table, row) {
  if (!row) return null;
  const out = {};
  for (const col of Object.keys(TABLES[table].columns)) {
    if (col in row) out[col] = fromDb(table, col, row[col]);
  }
  return out;
}

export const rowsOut = (table, rows) => rows.map(r => rowOut(table, r));

/** Colunas e valores a gravar, incluindo os índices cegos (NIP/e-mail). */
function columnsFor(table, data) {
  const spec = TABLES[table];
  const cols = Object.keys(spec.columns).filter(c => data[c] !== undefined);
  const values = cols.map(c => toDb(table, c, data[c]));
  for (const [col, hashCol] of Object.entries(spec.blind || {})) {
    if (data[col] !== undefined) { cols.push(hashCol); values.push(blindIndex(data[col])); }
  }
  return { cols, values };
}

/**
 * Insere ou atualiza (pela chave da tabela) uma linha.
 * `data` usa os nomes de coluna do banco; apenas colunas conhecidas são gravadas.
 * Nas tabelas de auditoria, um registro existente nunca é alterado.
 */
export async function upsertRow(table, data, { extra } = {}) {
  const spec = TABLES[table];
  const { cols, values } = columnsFor(table, data);
  if (extra !== undefined) {
    cols.push('extra_json');
    values.push(extra && Object.keys(extra).length ? JSON.stringify(extra) : null);
  }
  const updatable = cols.filter(c => !spec.key.includes(c) && c !== 'created_at');
  const touch = spec.columns.updated_at && !cols.includes('updated_at');
  const updateSql = [
    ...updatable.map(c => `"${c}" = excluded."${c}"`),
    ...(touch ? ['updated_at = now()'] : []),
  ];
  const appendOnly = APPEND_ONLY_TABLES.includes(table);
  const sql = `INSERT INTO ${table} (${cols.map(c => `"${c}"`).join(', ')})
    VALUES (${cols.map(() => '?').join(', ')})
    ON CONFLICT (${spec.key.join(', ')}) DO ${updateSql.length && !appendOnly ? `UPDATE SET ${updateSql.join(', ')}` : 'NOTHING'}`;
  await run(sql, values);
}

/** Atualiza colunas de uma linha existente. Retorna o número de linhas alteradas. */
export async function updateRow(table, where, data) {
  const spec = TABLES[table];
  const editable = Object.fromEntries(Object.entries(data).filter(([c]) => c in spec.columns && !spec.key.includes(c)));
  const { cols, values } = columnsFor(table, editable);
  if (!cols.length) return 0;
  const sets = cols.map(c => `"${c}" = ?`);
  if (spec.columns.updated_at && !cols.includes('updated_at')) sets.push('updated_at = now()');
  const whereCols = Object.keys(where);
  const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE ${whereCols.map(c => `"${c}" = ?`).join(' AND ')}`;
  return run(sql, [...values, ...whereCols.map(c => where[c])]);
}

/** Registro na trilha de auditoria (dados cifrados). */
export function addAudit(userName, action, field, oldValue = '-', newValue = '-') {
  return upsertRow('audit_logs', {
    id: newId(), timestamp: nowIso(), user_name: userName, action, field, old_value: oldValue, new_value: newValue,
  });
}

// ---------------------------------------------------------------------------
// Conexão, migrações e privilégios
// ---------------------------------------------------------------------------

const roleOf = (url) => decodeURIComponent(new URL(url).username || '');

async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}

async function migrate(client) {
  // Evita duas instâncias migrando ao mesmo tempo.
  await client.query("SELECT pg_advisory_lock(hashtext('sisferias-migracoes'))");
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const applied = new Set((await client.query('SELECT version FROM schema_migrations')).rows.map(r => r.version));
    for (const m of MIGRATIONS) {
      if (applied.has(m.version)) continue;
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [m.version, m.name]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
      console.log(`[banco] migração ${m.version} aplicada: ${m.name}`);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('sisferias-migracoes'))");
  }
}

/** Privilégio mínimo: a aplicação só lê/grava dados; a auditoria não pode ser alterada. */
async function grantAppPrivileges(client, appRole) {
  const role = client.escapeIdentifier(appRole);
  const appendOnly = APPEND_ONLY_TABLES.join(', ');
  await client.query(`
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${role};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role};
    REVOKE UPDATE, DELETE, TRUNCATE ON ${appendOnly} FROM ${role};
    REVOKE INSERT, UPDATE, DELETE ON schema_migrations, app_meta FROM ${role};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role};`);
}

/** Confere (ou cria, em banco novo) a chave de criptografia dos dados pessoais. */
async function setupKey(client) {
  const stored = (await client.query("SELECT value FROM app_meta WHERE key = 'key_fingerprint'")).rows[0]?.value;
  let master = loadMasterKey();
  if (!stored) {
    if (!master) {
      master = loadMasterKey({ create: true });
      console.log([
        '',
        '!'.repeat(64),
        'Chave de criptografia dos dados pessoais criada em:',
        `    ${master.source}`,
        'GUARDE UMA CÓPIA DESTE ARQUIVO EM LOCAL SEGURO (fora deste computador).',
        'Sem ele, os dados do banco e dos backups não poderão ser lidos.',
        '!'.repeat(64),
        '',
      ].join('\n'));
    }
    useMasterKey(master.key);
    await client.query("INSERT INTO app_meta (key, value) VALUES ('key_fingerprint', $1)", [keyFingerprint()]);
    return;
  }
  if (!master) {
    throw new Error([
      'A chave de criptografia dos dados não foi encontrada.',
      `Restaure o arquivo ${config.keyFile} (da sua cópia de segurança)`,
      'ou informe-a na variável SISFERIAS_CHAVE. O sistema não inicia sem ela.',
    ].join('\n'));
  }
  useMasterKey(master.key);
  if (keyFingerprint() !== stored) {
    throw new Error(`A chave de criptografia (${master.source}) não corresponde a este banco de dados. Use a chave original.`);
  }
}

/**
 * Conecta ao PostgreSQL (externo ou embutido), aplica as migrações e os
 * privilégios e carrega a chave de criptografia.
 */
export async function connectDb() {
  try {
    await openDb();
  } catch (err) {
    await closeDb({ stopEmbedded: 'if-started' }).catch(() => {});
    throw err;
  }
}

async function openDb() {
  let { url, ownerUrl } = config.database;
  if (!url) {
    embedded = await import('./pgembed.js').then(m => m.startEmbedded());
    ({ url, ownerUrl } = embedded);
    dbInfo.mode = 'embutido';
    dbInfo.description = `PostgreSQL embutido (${config.database.dir}, porta ${config.database.port}, somente localhost)`;
  } else {
    const u = new URL(url);
    dbInfo.mode = 'externo';
    dbInfo.description = `PostgreSQL externo (${u.hostname}:${u.port || 5432}${u.pathname})`;
  }
  dbInfo.appRole = roleOf(url);

  await withClient(ownerUrl || url, async (client) => {
    await migrate(client);
    if (ownerUrl && roleOf(ownerUrl) !== dbInfo.appRole) {
      await grantAppPrivileges(client, dbInfo.appRole);
      dbInfo.leastPrivilege = true;
    }
    await setupKey(client);
  });
  if (!dbInfo.leastPrivilege) {
    console.warn('[banco] AVISO: a aplicação usa o mesmo usuário do dono do banco. Para privilégio mínimo, informe database.ownerUrl (INSTALACAO.md).');
  }

  pool = new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 });
  pool.on('error', (err) => console.error('[banco] erro na conexão:', err.message));
  await one('SELECT 1');

  const { migrateLegacySqlite } = await import('./legacy.js');
  await migrateLegacySqlite();
}

/**
 * Fecha as conexões. `stopEmbedded`: true desliga o PostgreSQL embutido;
 * 'if-started' só o desliga se foi ligado por este processo (usado pelos
 * comandos de linha, para não derrubar o banco de um SISFERIAS em execução).
 */
export async function closeDb({ stopEmbedded = true } = {}) {
  if (pool) { await pool.end().catch(() => {}); pool = null; }
  if (embedded && (stopEmbedded === true || (stopEmbedded === 'if-started' && embedded.startedHere))) {
    await embedded.stop();
  }
  embedded = null;
}

// ---------------------------------------------------------------------------
// Contas de acesso
// ---------------------------------------------------------------------------

/** Conta de acesso pelo login (NIP ou e-mail). */
export function findAuthByLogin(login) {
  const value = String(login || '').trim();
  if (!value) return Promise.resolve(undefined);
  if (value.includes('@')) return one('SELECT * FROM auth_users WHERE email_hash = ?', [blindIndex(value)]);
  return one(`SELECT a.* FROM profiles p JOIN auth_users a ON a.id = p.id
    WHERE p.nip_hash = ? ORDER BY p.created_at LIMIT 1`, [blindIndex(value)]);
}

/** Cria a conta de acesso (ou atualiza a senha). Senha nova pode exigir troca no 1º acesso. */
export async function setAuthPassword(id, email, password, { mustChange = false } = {}) {
  const hash = await hashPassword(id, password);
  const exists = await one('SELECT 1 FROM auth_users WHERE id = ?', [id]);
  if (exists) {
    await run(`UPDATE auth_users SET password_hash = ?, must_change_password = ?, failed_attempts = 0,
      locked_at = NULL, password_changed_at = now() WHERE id = ?`, [hash, mustChange, id]);
  } else {
    await run(`INSERT INTO auth_users (id, email, email_hash, password_hash, must_change_password, password_changed_at)
      VALUES (?, ?, ?, ?, ?, now())`, [id, encrypt(email), blindIndex(email), hash, mustChange]);
  }
}

/** Senha provisória que já atende à regra (maiúscula, minúscula, número, especial). */
export function generatePassword() {
  return `Sf#${crypto.randomBytes(9).toString('base64url')}9a`;
}

// ---------------------------------------------------------------------------
// Dados iniciais
// ---------------------------------------------------------------------------

/** Dados iniciais e verificação do administrador (chamado ao iniciar o servidor). */
export async function seed() {
  if (!await one('SELECT 1 FROM system_settings WHERE id = 1')) {
    await upsertRow('system_settings', { id: 1, institution_name: 'MARINHA DO BRASIL', total_manpower: 100, staff_json: {} });
  }

  const hasAdmin = await one(`
    SELECT 1 FROM profiles p JOIN auth_users a ON a.id = p.id
    WHERE p.role = 'admin' AND a.password_hash IS NOT NULL LIMIT 1`);
  if (hasAdmin) return;

  const email = config.adminEmail;
  if (await one('SELECT 1 FROM auth_users WHERE email_hash = ?', [blindIndex(email)])) {
    // A conta inicial existe, mas não é admin ou está sem senha: não a
    // sobrescrevemos, apenas avisamos como recuperar o acesso.
    console.warn([
      '',
      '!'.repeat(60),
      'ATENÇÃO: nenhuma conta de ADMINISTRADOR com senha foi encontrada.',
      'Ninguém conseguirá acessar a área de Segurança até isso ser resolvido.',
      '',
      'Para recuperar o acesso, feche o SISFERIAS e execute nesta pasta:',
      '    npm run admin -- --senha NOVA_SENHA',
      'Para dar acesso de administrador a uma conta específica:',
      '    npm run admin -- --login NIP_OU_EMAIL --senha NOVA_SENHA',
      '',
      'Mais detalhes no arquivo INSTALACAO.md.',
      '!'.repeat(60),
      '',
    ].join('\n'));
    return;
  }

  const password = config.adminPassword || generatePassword();
  // Senha gerada (ou fora da regra) é provisória: troca obrigatória no 1º acesso.
  const mustChange = !config.adminPassword || passwordProblems(password).length > 0;
  const id = newId();
  await transaction(async () => {
    await setAuthPassword(id, email, password, { mustChange });
    await upsertRow('profiles', {
      id, email, name: 'Administrador', war_name: 'ADMIN', nip: 'admin', role: 'admin',
      is_blocked: false, view_all_sectors: true,
    });
  });

  const info = [
    'SISFERIAS - acesso inicial do administrador',
    `Login (NIP): admin    ou e-mail: ${email}`,
    `Senha provisória: ${password}`,
    '',
    'No primeiro acesso o sistema pedirá uma nova senha. Depois, apague este arquivo.',
    'Guia completo: INSTALACAO.md',
  ].join('\n');
  if (!config.adminPassword) {
    fs.writeFileSync(path.join(config.dataDir, 'ADMIN_INICIAL.txt'), info + '\n', { mode: 0o600 });
  }
  console.log('\n' + '='.repeat(60) + '\n' + info + '\n' + '='.repeat(60) + '\n');
}
