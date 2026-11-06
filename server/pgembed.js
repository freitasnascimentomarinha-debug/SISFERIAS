// PostgreSQL embutido: quando nenhum servidor PostgreSQL externo é informado,
// o SISFERIAS usa os binários oficiais do PostgreSQL (pacote
// @embedded-postgres/<plataforma>) e mantém o banco em data/postgres.
//
// - O banco aceita conexões apenas deste computador (localhost).
// - São criados três usuários de banco, com senhas aleatórias guardadas em
//   data/postgres-credenciais.json: o superusuário (só administração), o dono
//   do banco (cria/altera tabelas nas migrações) e o usuário da aplicação
//   (apenas lê e grava dados) — DCTIMARINST 30-17, item 4.1.
// - O PostgreSQL é iniciado pelo pg_ctl e continua de pé se o SISFERIAS cair;
//   na inicialização seguinte ele é reaproveitado.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import pg from 'pg';
import { config } from './config.js';

export const DB_NAME = 'sisferias';
export const OWNER_ROLE = 'sisferias_dono';
export const APP_ROLE = 'sisferias_app';

const PLATFORM_PACKAGES = {
  'win32-x64': '@embedded-postgres/windows-x64',
  'linux-x64': '@embedded-postgres/linux-x64',
  'linux-arm64': '@embedded-postgres/linux-arm64',
  'darwin-arm64': '@embedded-postgres/darwin-arm64',
  'darwin-x64': '@embedded-postgres/darwin-x64',
};

async function binaries() {
  const name = PLATFORM_PACKAGES[`${process.platform}-${process.arch}`];
  if (!name) throw new Error(`PostgreSQL embutido indisponível para ${process.platform}-${process.arch}. Informe um PostgreSQL externo (INSTALACAO.md).`);
  let mod;
  try {
    mod = await import(name);
  } catch {
    throw new Error(`Os binários do PostgreSQL (${name}) não estão instalados. Execute "npm install" ou informe um PostgreSQL externo (INSTALACAO.md).`);
  }
  const exe = (p) => (process.platform === 'win32' && !p.endsWith('.exe') ? `${p}.exe` : p);
  return { initdb: exe(mod.initdb), pgCtl: exe(mod.pg_ctl) };
}

// O PostgreSQL não roda como root (Linux). Nesse caso usamos o usuário "postgres".
function runAsIds() {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return {};
  const id = (flag) => Number(execFileSync('id', [flag, 'postgres'], { encoding: 'utf8' }).trim());
  try {
    return { uid: id('-u'), gid: id('-g') };
  } catch {
    execFileSync('useradd', ['--system', '--no-create-home', '--user-group', 'postgres']);
    return { uid: id('-u'), gid: id('-g') };
  }
}

/** Garante que o usuário "postgres" consiga chegar até a pasta de dados. */
function allowTraverse(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    try {
      const mode = fs.statSync(d).mode;
      if (!(mode & 0o001)) {
        fs.chmodSync(d, mode | 0o001);
        console.log(`[banco] permissão de passagem (o+x) concedida em ${d} para o usuário "postgres".`);
      }
    } catch { /* sem permissão: segue */ }
    if (path.dirname(d) === d) break;
  }
}

function run(file, args, ids, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { ...ids, env: { ...process.env, LC_MESSAGES: 'C' }, windowsHide: true });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('error', reject);
    let done = false;
    const finish = (code) => {
      if (done) return;
      done = true;
      if (code === 0 || quiet) resolve({ code, out });
      else reject(new Error(`${path.basename(file)} terminou com código ${code}:\n${out.trim()}`));
    };
    child.on('close', finish);
    // No Windows, o "pg_ctl start" termina, mas o PostgreSQL que ele inicia herda
    // a saída do processo e a mantém aberta: o evento "close" nunca chegaria.
    // Por isso também se conclui pelo término do próprio processo ("exit").
    child.on('exit', code => setTimeout(() => finish(code), 300));
  });
}

const randomPassword = () => crypto.randomBytes(24).toString('base64url');

function readCredentials() {
  try { return JSON.parse(fs.readFileSync(config.database.credentialsFile, 'utf8')); } catch { return null; }
}

/**
 * Inicia (ou reaproveita) o PostgreSQL embutido e devolve as URLs de conexão
 * { url, ownerUrl, stop }.
 */
export async function startEmbedded() {
  const { initdb, pgCtl } = await binaries();
  const dir = config.database.dir;
  const ids = runAsIds();
  const port = config.database.port;
  let creds = readCredentials();
  if (ids.uid !== undefined) allowTraverse(path.dirname(dir));

  if (!fs.existsSync(path.join(dir, 'PG_VERSION'))) {
    console.log('[banco] criando o banco de dados PostgreSQL (primeira execução)...');
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    // No Windows o initdb cria a pasta: se ela já existir, ele não consegue
    // ajustar as permissões (Permission denied) quando roda com token restrito.
    if (process.platform !== 'win32') fs.mkdirSync(dir, { mode: 0o700 });
    if (ids.uid !== undefined) { fs.chownSync(dir, ids.uid, ids.gid); allowTraverse(path.dirname(dir)); }
    creds = { superPassword: randomPassword(), ownerPassword: randomPassword(), appPassword: randomPassword(), configured: false };
    fs.writeFileSync(config.database.credentialsFile, JSON.stringify(creds, null, 2) + '\n', { mode: 0o600 });
    const pwFile = path.join(os.tmpdir(), `sisferias-pg-${process.pid}-${Date.now()}`);
    fs.writeFileSync(pwFile, creds.superPassword + '\n', { mode: 0o600 });
    if (ids.uid !== undefined) fs.chownSync(pwFile, ids.uid, ids.gid);
    try {
      await run(initdb, ['-D', dir, '-U', 'postgres', `--pwfile=${pwFile}`, '-A', 'scram-sha-256', '-E', 'UTF8', '--locale=C'], ids);
    } finally {
      fs.rmSync(pwFile, { force: true });
    }
    // Somente conexões locais, com registro de conexões e de alterações de estrutura.
    fs.appendFileSync(path.join(dir, 'postgresql.conf'), [
      '',
      '# --- SISFERIAS ---',
      "listen_addresses = 'localhost'",
      'log_connections = on',
      'log_disconnections = on',
      "log_statement = 'ddl'",
      'logging_collector = on',
      "log_directory = 'log'",
      'log_rotation_size = 10MB',
      "password_encryption = 'scram-sha-256'",
      '',
    ].join('\n'));
  }
  if (!creds) throw new Error(`Credenciais do banco não encontradas (${config.database.credentialsFile}).`);

  // Desligamento sem encerrar o banco (falta de energia, botão de desligar) deixa a trava
  // postmaster.pid para trás. Se o número de processo dela agora pertence a outro programa,
  // o PostgreSQL se recusa a iniciar: a trava antiga é removida.
  removerTravaAntiga(dir);

  // Já está rodando (ex.: o SISFERIAS caiu e foi reiniciado)? Então reaproveita.
  const status = await run(pgCtl, ['status', '-D', dir], ids, { quiet: true });
  const startedHere = status.code !== 0;
  if (startedHere) {
    const logFile = path.join(dir, 'inicializacao.log');
    try {
      await run(pgCtl, ['start', '-D', dir, '-w', '-t', '120', '-l', logFile, '-o', `-p ${port}`], ids);
    } catch (err) {
      let tail = '';
      try { tail = fs.readFileSync(logFile, 'utf8').split('\n').slice(-15).join('\n'); } catch { /* sem log */ }
      throw new Error(`Não foi possível iniciar o PostgreSQL na porta ${port}.\n${err.message}\n${tail}`);
    }
  }

  const url = (user, password, database) =>
    `postgres://${user}:${encodeURIComponent(password)}@localhost:${port}/${database}`;

  if (!creds.configured) {
    await createRolesAndDatabase(url('postgres', creds.superPassword, 'postgres'), creds);
    creds.configured = true;
    fs.writeFileSync(config.database.credentialsFile, JSON.stringify(creds, null, 2) + '\n', { mode: 0o600 });
  }

  return {
    url: url(APP_ROLE, creds.appPassword, DB_NAME),
    ownerUrl: url(OWNER_ROLE, creds.ownerPassword, DB_NAME),
    appRole: APP_ROLE,
    startedHere,
    stop: () => {
      if (ids.uid !== undefined) allowTraverse(path.dirname(dir));
      return run(pgCtl, ['stop', '-D', dir, '-m', 'fast', '-w'], ids, { quiet: true });
    },
  };
}

/** Nome do programa com esse número de processo, ou null se não existe. */
function nomeDoProcesso(pid) {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
      const m = out.match(/^"([^"]+)","(\d+)"/m);
      return m && Number(m[2]) === pid ? m[1].toLowerCase() : null;
    }
    return fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim().toLowerCase();
  } catch {
    return null;
  }
}

/** Remove o postmaster.pid deixado por um desligamento inesperado (o processo dele não é mais o PostgreSQL). */
export function removerTravaAntiga(dir, nome = nomeDoProcesso) {
  const lock = path.join(dir, 'postmaster.pid');
  let pid;
  try { pid = Number(fs.readFileSync(lock, 'utf8').split('\n')[0].trim()); } catch { return false; }
  if (!Number.isInteger(pid) || pid <= 0) { fs.rmSync(lock, { force: true }); return true; }
  const atual = nome(pid);
  if (atual && atual.startsWith('postgres')) return false; // o banco está rodando de verdade
  console.log(`[banco] removendo a trava de um desligamento anterior (processo ${pid} ${atual ? `agora é ${atual}` : 'não existe mais'}).`);
  fs.rmSync(lock, { force: true });
  return true;
}

/** Cria o dono do banco, o usuário da aplicação e o banco (idempotente). */
export async function createRolesAndDatabase(superUrl, { ownerPassword, appPassword, database = DB_NAME, ownerRole = OWNER_ROLE, appRole = APP_ROLE }) {
  const client = new pg.Client({ connectionString: superUrl });
  await client.connect();
  try {
    const lit = (s) => client.escapeLiteral(s);
    const id = (s) => client.escapeIdentifier(s);
    for (const [role, password] of [[ownerRole, ownerPassword], [appRole, appPassword]]) {
      const exists = (await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).rowCount;
      await client.query(`${exists ? 'ALTER' : 'CREATE'} ROLE ${id(role)} LOGIN PASSWORD ${lit(password)} NOSUPERUSER NOCREATEDB NOCREATEROLE`);
    }
    const dbExists = (await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])).rowCount;
    if (!dbExists) await client.query(`CREATE DATABASE ${id(database)} OWNER ${id(ownerRole)} ENCODING 'UTF8' TEMPLATE template0`);
    await client.query(`REVOKE ALL ON DATABASE ${id(database)} FROM PUBLIC`);
    await client.query(`GRANT CONNECT, TEMPORARY ON DATABASE ${id(database)} TO ${id(appRole)}`);
  } finally {
    await client.end();
  }
  // No banco novo: o esquema public pertence ao dono e ninguém mais cria objetos nele.
  const dbUrl = new URL(superUrl);
  dbUrl.pathname = `/${database}`;
  const c2 = new pg.Client({ connectionString: dbUrl.toString() });
  await c2.connect();
  try {
    await c2.query(`ALTER SCHEMA public OWNER TO ${c2.escapeIdentifier(ownerRole)}`);
    await c2.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    await c2.query(`GRANT USAGE ON SCHEMA public TO ${c2.escapeIdentifier(appRole)}`);
  } finally {
    await c2.end();
  }
}

/** Desliga o PostgreSQL embutido, se estiver ligado (ex.: ao parar o serviço). */
export async function stopEmbeddedCluster() {
  const dir = config.database.dir;
  if (!fs.existsSync(path.join(dir, 'PG_VERSION'))) return false;
  const { pgCtl } = await binaries();
  const ids = runAsIds();
  if (ids.uid !== undefined) allowTraverse(path.dirname(dir));
  const status = await run(pgCtl, ['status', '-D', dir], ids, { quiet: true });
  if (status.code !== 0) return false;
  await run(pgCtl, ['stop', '-D', dir, '-m', 'fast', '-w'], ids);
  return true;
}
