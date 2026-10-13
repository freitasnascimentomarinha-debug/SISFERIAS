import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';
import { config } from './config.js';

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);

/**
 * Cria uma cópia consistente do banco (mesmo com o sistema em uso) em
 * data/backups/. Retorna o caminho do arquivo criado.
 */
export function createBackup(reason = 'manual') {
  fs.mkdirSync(config.backupDir, { recursive: true });
  const safeReason = reason.replace(/[^a-z0-9-]/gi, '');
  let file = path.join(config.backupDir, `sisferias_${stamp()}_${safeReason}.db`);
  for (let n = 2; fs.existsSync(file); n += 1) {
    file = path.join(config.backupDir, `sisferias_${stamp()}_${safeReason}-${n}.db`);
  }
  db.prepare('VACUUM INTO ?').run(file);
  pruneBackups();
  return file;
}

export function listBackups() {
  if (!fs.existsSync(config.backupDir)) return [];
  return fs.readdirSync(config.backupDir)
    .filter(f => f.endsWith('.db'))
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
  const run = () => {
    const today = new Date().toISOString().slice(0, 10);
    const already = listBackups().some(b => b.file.includes(today) && b.file.endsWith('_diario.db'));
    if (!already) {
      try {
        const file = createBackup('diario');
        console.log(`[backup] backup diário criado: ${path.basename(file)}`);
      } catch (err) {
        console.error('[backup] falha no backup diário:', err.message);
      }
    }
  };
  run();
  setInterval(run, 60 * 60_000).unref();
}
