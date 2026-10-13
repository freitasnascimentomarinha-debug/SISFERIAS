import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { TABLES, MIGRATIONS } from './schema.js';
import { config } from './config.js';

export const nowIso = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(config.dbFile);
// WAL: leituras e gravações não se bloqueiam; busy_timeout faz uma gravação
// aguardar a outra em vez de falhar.
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

// ---------------------------------------------------------------------------
// Conversão de valores
// ---------------------------------------------------------------------------

const TRUE_VALUES = new Set(['true', 't', '1', 'sim', 's', 'yes', 'y']);

export function toDb(type, value) {
  if (value === undefined || value === null) return null;
  switch (type) {
    case 'bool':
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'number') return value ? 1 : 0;
      return TRUE_VALUES.has(String(value).trim().toLowerCase()) ? 1 : 0;
    case 'int': {
      if (value === '') return null;
      const n = Number.parseInt(value, 10);
      return Number.isFinite(n) ? n : null;
    }
    case 'real': {
      if (value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
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

export function fromDb(type, value) {
  if (value === undefined || value === null) return null;
  switch (type) {
    case 'bool':
      return !!value;
    case 'json':
      try { return JSON.parse(value); } catch { return null; }
    default:
      return value;
  }
}

/** Converte uma linha do banco para o formato da API. */
export function rowOut(table, row) {
  if (!row) return null;
  const { columns } = TABLES[table];
  const out = {};
  for (const [col, type] of Object.entries(columns)) {
    if (col in row) out[col] = fromDb(type, row[col]);
  }
  return out;
}

export const rowsOut = (table, rows) => rows.map(r => rowOut(table, r));

/**
 * Insere ou atualiza (pela chave da tabela) uma linha.
 * `data` usa os nomes de coluna do banco; apenas colunas conhecidas são gravadas.
 */
export function upsertRow(table, data, { extra } = {}) {
  const spec = TABLES[table];
  const cols = Object.keys(spec.columns).filter(c => data[c] !== undefined);
  const values = cols.map(c => toDb(spec.columns[c], data[c]));
  if (extra !== undefined) {
    cols.push('extra_json');
    values.push(extra && Object.keys(extra).length ? JSON.stringify(extra) : null);
  }
  const updatable = cols.filter(c => !spec.key.includes(c) && c !== 'created_at');
  const touch = spec.columns.updated_at && !cols.includes('updated_at');
  const updateSql = [
    ...updatable.map(c => `"${c}" = excluded."${c}"`),
    ...(touch ? [`updated_at = '${nowIso()}'`] : []),
  ];
  const sql = `INSERT INTO ${table} (${cols.map(c => `"${c}"`).join(', ')})
    VALUES (${cols.map(() => '?').join(', ')})
    ON CONFLICT (${spec.key.join(', ')}) DO ${updateSql.length ? `UPDATE SET ${updateSql.join(', ')}` : 'NOTHING'}`;
  db.prepare(sql).run(...values);
}

/** Atualiza colunas de uma linha existente. Retorna o número de linhas alteradas. */
export function updateRow(table, where, data) {
  const spec = TABLES[table];
  const cols = Object.keys(data).filter(c => c in spec.columns && !spec.key.includes(c));
  if (!cols.length) return 0;
  const sets = cols.map(c => `"${c}" = ?`);
  if (spec.columns.updated_at && !cols.includes('updated_at')) sets.push(`updated_at = '${nowIso()}'`);
  const whereCols = Object.keys(where);
  const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE ${whereCols.map(c => `"${c}" = ?`).join(' AND ')}`;
  const result = db.prepare(sql).run(
    ...cols.map(c => toDb(spec.columns[c], data[c])),
    ...whereCols.map(c => where[c]),
  );
  return Number(result.changes);
}

/** Executa `fn` dentro de uma transação; desfaz tudo se houver erro. */
export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Senhas
// ---------------------------------------------------------------------------

export const hashPassword = (plain) => bcrypt.hashSync(plain, 10);

export function verifyPassword(plain, hash) {
  if (!hash) return false;
  // Hashes "$2y$" (PHP) são equivalentes a "$2a$".
  const normalized = hash.startsWith('$2y$') ? `$2a$${hash.slice(4)}` : hash;
  try {
    return bcrypt.compareSync(plain, normalized);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Migrações e dados iniciais
// ---------------------------------------------------------------------------

function migrate() {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT)');
  const applied = new Set(db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version));
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, nowIso());
    });
    console.log(`[banco] migração ${m.version} aplicada: ${m.name}`);
  }
}

function seed() {
  const hasSettings = db.prepare('SELECT 1 FROM system_settings WHERE id = 1').get();
  if (!hasSettings) {
    upsertRow('system_settings', { id: 1, institution_name: 'MARINHA DO BRASIL', total_manpower: 100, staff_json: {} });
  }

  const hasAdmin = db.prepare(`
    SELECT 1 FROM profiles p JOIN auth_users a ON a.id = p.id
    WHERE p.role = 'admin' AND a.password_hash IS NOT NULL LIMIT 1`).get();
  if (hasAdmin) return;

  const email = config.adminEmail;
  const existing = db.prepare('SELECT id FROM auth_users WHERE email = ?').get(email);
  if (existing) return; // conta já existe (sem perfil admin); não sobrescrever

  const password = config.adminPassword || crypto.randomBytes(6).toString('base64url');
  const id = newId();
  transaction(() => {
    db.prepare('INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(id, email, hashPassword(password), nowIso());
    upsertRow('profiles', {
      id, email, name: 'Administrador', war_name: 'ADMIN', nip: 'admin', role: 'admin',
      is_blocked: false, view_all_sectors: true,
    });
  });

  const info = [
    'SISFERIAS - acesso inicial do administrador',
    `Login (NIP): admin    ou e-mail: ${email}`,
    `Senha: ${password}`,
    '',
    'Troque esta senha após o primeiro acesso e apague este arquivo.',
  ].join('\n');
  if (!config.adminPassword) {
    fs.writeFileSync(path.join(config.dataDir, 'ADMIN_INICIAL.txt'), info + '\n', { mode: 0o600 });
  }
  console.log('\n' + '='.repeat(60) + '\n' + info + '\n' + '='.repeat(60) + '\n');
}

migrate();
seed();
