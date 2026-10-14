// Migração automática dos dados das versões 2.x (SQLite) para o PostgreSQL.
//
// Na primeira execução da versão 3, se existir data/sisferias.db e o banco
// PostgreSQL ainda estiver vazio, todos os registros são copiados (já
// cifrados) e o arquivo antigo é renomeado para sisferias.db.migrado-<data>,
// guardado como cópia de segurança. As senhas dos usuários são mantidas.
import fs from 'node:fs';
import { config } from './config.js';
import { TABLES, TABLE_ORDER } from './schema.js';
import { one, run, upsertRow, transaction, nowIso } from './db.js';
import { encrypt, blindIndex } from './crypto.js';
import { createBackup } from './backup.js';

export async function migrateLegacySqlite({ file = config.legacySqliteFile, force = false } = {}) {
  if (!fs.existsSync(file)) return null;
  // Roda antes da criação do administrador inicial: banco novo não tem perfis.
  const hasData = await one('SELECT 1 FROM profiles LIMIT 1');
  if (hasData && !force) {
    console.warn(`[migração] ${file} existe, mas o banco PostgreSQL já tem dados: nada foi migrado. Use "npm run banco -- migrar-sqlite" se necessário.`);
    return null;
  }

  console.log(`[migração] copiando os dados de ${file} para o PostgreSQL...`);
  const { DatabaseSync } = await import('node:sqlite');
  const old = new DatabaseSync(file, { readOnly: true });
  const counts = {};
  try {
    const tableExists = (t) => !!old.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
    await transaction(async () => {
      if (tableExists('auth_users')) {
        for (const a of old.prepare('SELECT * FROM auth_users').all()) {
          await run(`INSERT INTO auth_users (id, email, email_hash, password_hash, created_at)
            VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
          [a.id, encrypt(a.email), blindIndex(a.email), a.password_hash || null, a.created_at || nowIso()]);
        }
        counts.auth_users = old.prepare('SELECT COUNT(*) c FROM auth_users').get().c;
      }
      for (const table of TABLE_ORDER) {
        if (!tableExists(table)) continue;
        const rows = old.prepare(`SELECT * FROM ${table}`).all();
        for (const row of rows) {
          const data = {};
          for (const col of Object.keys(TABLES[table].columns)) {
            if (row[col] !== undefined && row[col] !== null) data[col] = row[col];
          }
          let extra;
          if (row.extra_json) { try { extra = JSON.parse(row.extra_json); } catch { /* ignora */ } }
          await upsertRow(table, data, extra ? { extra } : {});
        }
        counts[table] = rows.length;
      }
    });
  } finally {
    old.close();
  }

  const stamp = new Date().toISOString().slice(0, 10);
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(file + suffix)) fs.renameSync(file + suffix, `${file}.migrado-${stamp}${suffix}`);
  }
  console.log(`[migração] concluída: ${Object.entries(counts).map(([t, n]) => `${t}=${n}`).join(', ')}`);
  console.log(`[migração] o arquivo antigo foi mantido como ${file}.migrado-${stamp}`);
  await createBackup('apos-migracao');
  return counts;
}
