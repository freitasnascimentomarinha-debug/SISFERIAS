import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const dataDir = path.resolve(ROOT_DIR, process.env.DATA_DIR || 'data');

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  dataDir,
  dbFile: path.join(dataDir, 'sisferias.db'),
  backupDir: path.join(dataDir, 'backups'),
  distDir: path.join(ROOT_DIR, 'dist'),
  // Conta criada automaticamente na primeira execução, se não houver admin.
  adminEmail: process.env.ADMIN_EMAIL || 'admin@sisferias.local',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  sessionDays: Number(process.env.SESSION_DAYS) || 7,
  // Tamanho mínimo de senha em todo o sistema.
  minPasswordLength: 6,
  // Minutos de inatividade até a área de Segurança pedir a senha de novo.
  elevationMinutes: Number(process.env.ELEVATION_MINUTES) || 15,
  // Quantidade de backups automáticos mantidos (os mais antigos são apagados).
  keepBackups: Number(process.env.KEEP_BACKUPS) || 30,
};
