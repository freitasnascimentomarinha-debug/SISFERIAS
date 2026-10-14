// Utilitários dos testes: sobe um servidor SISFERIAS isolado (pasta e porta
// próprias) e conversa com a API guardando o cookie de sessão.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ADMIN_PASSWORD = 'Admin@Teste1';

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  srv.on('error', reject);
});

/**
 * Inicia um servidor em uma pasta temporária, com PostgreSQL embutido próprio.
 * Use `stop()` ao final. Por padrão os testes usam HTTP; passe
 * `env: { HTTPS: '1' }` (ou `HTTPS: undefined`, o padrão do sistema) para HTTPS.
 */
export async function startServer({ dataDir, port, pgPort, env = {} } = {}) {
  dataDir = dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'sisferias-teste-'));
  port = port || await freePort();
  pgPort = pgPort || await freePort();
  const childEnv = {
    ...process.env, DATA_DIR: dataDir, PORT: String(port), PG_PORT: String(pgPort), HOST: '127.0.0.1',
    ADMIN_PASSWORD, HTTPS: '0', BCRYPT_COST: '4', ...env,
  };
  for (const [k, v] of Object.entries(childEnv)) if (v === undefined) delete childEnv[k];
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'start.js')], {
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  const secure = childEnv.HTTPS === undefined || ['1', 'true'].includes(childEnv.HTTPS);
  const base = `${secure ? 'https' : 'http'}://127.0.0.1:${port}`;
  const healthy = () => new Promise(resolve => {
    const req = (secure ? https : http).get(`${base}/api/health`, { rejectUnauthorized: false }, res => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
  });
  // A primeira execução cria o banco e, com HTTPS, o certificado (alguns segundos).
  for (let i = 0; i < 600; i += 1) {
    if (await healthy()) break;
    if (child.exitCode !== null) throw new Error(`servidor não iniciou:\n${output}`);
    await new Promise(r => setTimeout(r, 100));
  }
  return {
    base, port, pgPort, dataDir, child,
    output: () => output,
    /** Consulta direta ao banco, como o usuário da aplicação (ou outro papel). */
    sql: async (text, params = [], { role = 'app' } = {}) => {
      const creds = JSON.parse(fs.readFileSync(path.join(dataDir, 'postgres-credenciais.json'), 'utf8'));
      const user = { app: 'sisferias_app', dono: 'sisferias_dono', postgres: 'postgres' }[role];
      const password = { app: creds.appPassword, dono: creds.ownerPassword, postgres: creds.superPassword }[role];
      const c = new pg.Client({ host: 'localhost', port: pgPort, user, password, database: 'sisferias' });
      await c.connect();
      try { return (await c.query(text, params)).rows; } finally { await c.end(); }
    },
    stop: () => new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      child.kill();
    }),
  };
}

/** Cliente da API com cookie de sessão (um por "pessoa"). */
export function client(base) {
  let cookie = '';
  async function call(method, p, body) {
    const res = await fetch(base + '/api' + p, {
      method,
      headers: {
        'X-Requested-With': 'sisferias',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  }
  return {
    get: (p) => call('GET', p),
    post: (p, b = {}) => call('POST', p, b),
    put: (p, b = {}) => call('PUT', p, b),
    patch: (p, b = {}) => call('PATCH', p, b),
    del: (p) => call('DELETE', p),
    login: (login, password) => call('POST', '/auth/login', { login, password }),
    rawCookie: () => cookie,
  };
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
