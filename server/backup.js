// Backups do banco de dados.
//
// Cada backup é um arquivo JSON com todas as tabelas, no mesmo formato da
// exportação (pode ser restaurado em Segurança > Dados > Importar). Os dados
// pessoais permanecem CIFRADOS no arquivo: para restaurá-lo é preciso a mesma
// chave de criptografia (data/chave-dados.key).
import fs from 'node:fs';
import path from 'node:path';
import { q, one, run, nowIso } from './db.js';
import { config } from './config.js';
import { TABLES, TABLE_ORDER } from './schema.js';
import { keyFingerprint } from './crypto.js';

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const BACKUP_RE = /^sisferias_.*\.json$/;

/** Todas as tabelas como estão no banco (dados pessoais cifrados). */
export async function rawDump() {
  const tables = {};
  for (const table of TABLE_ORDER) {
    const cols = [...Object.keys(TABLES[table].columns), 'extra_json'];
    tables[table] = await q(`SELECT ${cols.map(c => `"${c}"`).join(', ')} FROM ${table}`);
  }
  const authUsers = await q(`SELECT id, email, password_hash, must_change_password, failed_attempts,
    locked_at, password_changed_at, created_at FROM auth_users`);
  return {
    format: 'sisferias-backup',
    version: 2,
    encrypted: true,
    key_fingerprint: keyFingerprint(),
    exported_at: nowIso(),
    tables,
    auth_users: authUsers,
  };
}

/**
 * Cria um backup consistente (mesmo com o sistema em uso) em data/backups/.
 * Retorna o caminho do arquivo criado.
 */
export async function createBackup(reason = 'manual', { copy = true } = {}) {
  fs.mkdirSync(config.backupDir, { recursive: true });
  const safeReason = reason.replace(/[^a-z0-9-]/gi, '');
  let file = path.join(config.backupDir, `sisferias_${stamp()}_${safeReason}.json`);
  for (let n = 2; fs.existsSync(file); n += 1) {
    file = path.join(config.backupDir, `sisferias_${stamp()}_${safeReason}-${n}.json`);
  }
  const dump = await rawDump();
  await fs.promises.writeFile(file, JSON.stringify(dump), { mode: 0o600 });
  pruneBackups();
  if (copy) void copyToExtraFolder(file); // em segundo plano
  return file;
}

// ---------------------------------------------------------------------------
// Cópia extra dos backups (pasta de rede, outro disco, pen drive...)
// ---------------------------------------------------------------------------

export const getBackupCopyDir = async () =>
  (await one('SELECT backup_copy_dir d FROM system_settings WHERE id = 1'))?.d || null;

const setCopyStatus = (status) =>
  run('UPDATE system_settings SET backup_copy_status = ? WHERE id = 1', [JSON.stringify(status)]);

export const getBackupCopyStatus = async () =>
  (await one('SELECT backup_copy_status s FROM system_settings WHERE id = 1'))?.s || null;

const COPY_TIMEOUT_MS = 15_000;

/** Rejeita se a operação demorar demais (ex.: pasta de rede fora do ar). */
function withTimeout(promise, ms, what) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what}: sem resposta após ${ms / 1000} s (pasta inacessível?)`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

/** Testa se é possível gravar na pasta (cria, grava e apaga um arquivo). */
export async function testCopyDir(dir) {
  const probe = path.join(dir, `.sisferias-teste-${process.pid}-${Date.now()}`);
  await withTimeout((async () => {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(probe, 'ok');
    await fs.promises.rm(probe, { force: true });
  })(), COPY_TIMEOUT_MS, 'teste de gravação');
}

/**
 * Copia o backup para a pasta extra, se configurada. Roda em segundo plano
 * (sem travar o sistema, mesmo se a pasta de rede estiver lenta) e nunca
 * derruba o backup principal. Retorna uma promessa que sempre se resolve.
 */
export async function copyToExtraFolder(file) {
  let dir;
  try { dir = await getBackupCopyDir(); } catch { return; }
  if (!dir) return;
  try {
    await withTimeout((async () => {
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.copyFile(file, path.join(dir, path.basename(file)));
      // Mantém na pasta extra a mesma quantidade de backups da pasta principal.
      const names = (await fs.promises.readdir(dir)).filter(f => BACKUP_RE.test(f));
      const copies = await Promise.all(names.map(async f => ({ f, t: (await fs.promises.stat(path.join(dir, f))).mtimeMs })));
      copies.sort((a, b) => b.t - a.t);
      await Promise.all(copies.slice(config.keepBackups).map(old => fs.promises.rm(path.join(dir, old.f), { force: true })));
    })(), COPY_TIMEOUT_MS * 4, 'cópia do backup');
    await setCopyStatus({ ok: true, at: new Date().toISOString(), file: path.basename(file) });
  } catch (err) {
    console.error(`[backup] falha ao copiar para ${dir}: ${err.message}`);
    await setCopyStatus({ ok: false, at: new Date().toISOString(), file: path.basename(file), message: err.message }).catch(() => {});
  }
}

/** Define (ou remove, com null) a pasta extra. Rejeita se não for possível gravar nela. */
export async function setBackupCopyDir(dir) {
  if (dir) {
    const resolved = path.resolve(dir);
    if (path.resolve(config.backupDir) === resolved) throw new Error('escolha uma pasta diferente da pasta principal de backups.');
    await testCopyDir(resolved);
    await run('UPDATE system_settings SET backup_copy_dir = ?, backup_copy_status = NULL WHERE id = 1', [resolved]);
  } else {
    await run('UPDATE system_settings SET backup_copy_dir = NULL, backup_copy_status = NULL WHERE id = 1');
  }
  return getBackupCopyDir();
}

export function listBackups() {
  if (!fs.existsSync(config.backupDir)) return [];
  return fs.readdirSync(config.backupDir)
    .filter(f => BACKUP_RE.test(f))
    .map(f => {
      const st = fs.statSync(path.join(config.backupDir, f));
      return { file: f, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function pruneBackups() {
  const backups = listBackups();
  for (const old of backups.slice(config.keepBackups)) {
    fs.rmSync(path.join(config.backupDir, old.file), { force: true });
  }
}

/** Backup diário automático enquanto o servidor estiver ligado. */
export function scheduleDailyBackup() {
  const daily = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const already = listBackups().some(b => b.file.includes(today) && b.file.endsWith('_diario.json'));
    if (!already) {
      try {
        const file = await createBackup('diario');
        console.log(`[backup] backup diário criado: ${path.basename(file)}`);
      } catch (err) {
        console.error('[backup] falha no backup diário:', err.message);
      }
    }
  };
  void daily();
  setInterval(daily, 60 * 60_000).unref();
}
