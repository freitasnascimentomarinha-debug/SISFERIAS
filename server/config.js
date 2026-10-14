import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const dataDir = path.resolve(ROOT_DIR, process.env.DATA_DIR || 'data');

// Configurações gravadas em data/config.json (ex.: HTTPS, porta). Ficam junto
// dos dados para valerem também no modo serviço, que não recebe variáveis de
// ambiente. As variáveis de ambiente, quando informadas, têm prioridade.
export const CONFIG_FILE = path.join(dataDir, 'config.json');
export function readConfigFile() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
export function writeConfigFile(values) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(values, null, 2) + '\n');
}
const fileConfig = readConfigFile();

const envFlag = (value) => (value === undefined ? undefined : ['1', 'true', 'sim', 'yes'].includes(String(value).toLowerCase()));

export const config = {
  port: Number(process.env.PORT) || Number(fileConfig.port) || 3000,
  host: process.env.HOST || fileConfig.host || '0.0.0.0',
  dataDir,
  dbFile: path.join(dataDir, 'sisferias.db'),
  backupDir: path.join(dataDir, 'backups'),
  distDir: path.join(ROOT_DIR, 'dist'),
  // HTTPS: certificado próprio (cert/key) ou gerado automaticamente em data/certs.
  https: {
    enabled: envFlag(process.env.HTTPS) ?? !!fileConfig.https?.enabled,
    cert: process.env.HTTPS_CERT || fileConfig.https?.cert || '',
    key: process.env.HTTPS_KEY || fileConfig.https?.key || '',
  },
  certDir: path.join(dataDir, 'certs'),
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
