// Usado por lib.mjs: lê todas as tabelas do PostgreSQL dos testes, decifra os
// dados pessoais com a chave da instalação e imprime em JSON. Assim os testes
// conferem o que foi gravado com consultas SQL simples (ver db() em lib.mjs).
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const dir = process.env.E2E_DIR;
process.env.DATA_DIR = path.join(dir, 'data');
const { loadMasterKey, useMasterKey } = await import('../../server/crypto.js');
const { TABLES } = await import('../../server/schema.js');
const { fromDb } = await import('../../server/db.js');

useMasterKey(loadMasterKey().key);
const creds = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'postgres-credenciais.json'), 'utf8'));
const client = new pg.Client({
  host: 'localhost', port: Number(process.env.E2E_PG_PORT), user: 'sisferias_app', password: creds.appPassword, database: 'sisferias',
});
await client.connect();
const out = {};
try {
  for (const table of Object.keys(TABLES)) {
    const rows = (await client.query(`SELECT * FROM ${table}`)).rows;
    out[table] = rows.map(row => {
      const r = {};
      for (const col of Object.keys(TABLES[table].columns)) {
        const v = fromDb(table, col, row[col]);
        // Formato do SQLite das versões anteriores: booleanos 0/1 e JSON em texto.
        r[col] = typeof v === 'boolean' ? (v ? 1 : 0) : v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
      }
      return r;
    });
  }
} finally {
  await client.end();
}
process.stdout.write(JSON.stringify(out));
