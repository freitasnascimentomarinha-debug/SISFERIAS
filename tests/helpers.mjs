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

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ADMIN_PASSWORD = 'Admin@Teste1';

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  srv.on('error', reject);
});

/** Inicia um servidor em uma pasta temporária. Use `stop()` ao final. */
export async function startServer({ dataDir, port, env = {} } = {}) {
  dataDir = dataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'sisferias-teste-'));
  port = port || await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'start.js')], {
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', ADMIN_PASSWORD, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  const secure = env.HTTPS === '1';
  const base = `${secure ? 'https' : 'http'}://127.0.0.1:${port}`;
  const healthy = () => new Promise(resolve => {
    const req = (secure ? https : http).get(`${base}/api/health`, { rejectUnauthorized: false }, res => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
  });
  // HTTPS gera o certificado na primeira vez (alguns segundos).
  for (let i = 0; i < 300; i += 1) {
    if (await healthy()) break;
    if (child.exitCode !== null) throw new Error(`servidor não iniciou:\n${output}`);
    await new Promise(r => setTimeout(r, 100));
  }
  return {
    base, port, dataDir, child,
    output: () => output,
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
