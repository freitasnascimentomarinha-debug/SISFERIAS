import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const dataDir = path.resolve(ROOT_DIR, process.env.DATA_DIR || 'data');

// Configurações gravadas em data/config.json (ex.: HTTPS, porta, banco). Ficam junto
// dos dados para valerem também no modo serviço, que não recebe variáveis de
// ambiente. As variáveis de ambiente, quando informadas, têm prioridade.
export const CONFIG_FILE = path.join(dataDir, 'config.json');
export function readConfigFile() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
export function writeConfigFile(values) {
  fs.mkdirSync(dataDir, { recursive: true });
  // Pode conter senhas de acesso ao banco: legível só pelo dono do arquivo.
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(values, null, 2) + '\n', { mode: 0o600 });
}
const fileConfig = readConfigFile();

const envFlag = (value) => (value === undefined ? undefined : ['1', 'true', 'sim', 'yes'].includes(String(value).toLowerCase()));

export const config = {
  port: Number(process.env.PORT) || Number(fileConfig.port) || 3000,
  host: process.env.HOST || fileConfig.host || '0.0.0.0',
  dataDir,
  backupDir: path.join(dataDir, 'backups'),
  distDir: path.join(ROOT_DIR, 'dist'),
  // Banco das versões 2.x (SQLite). Se existir, os dados são migrados para o
  // PostgreSQL na primeira execução e o arquivo é renomeado.
  legacySqliteFile: path.join(dataDir, 'sisferias.db'),
  // Banco de dados PostgreSQL (DCTIMBOTEC 30/002/2023).
  //  - Externo (recomendado em produção, ex.: servidor do CLTI): informe
  //    database.url (usuário da aplicação, só leitura/gravação de dados) e,
  //    opcionalmente, database.ownerUrl (dono do banco, usado nas migrações).
  //  - Sem url: o SISFERIAS inicia um PostgreSQL próprio em data/postgres,
  //    acessível apenas por este computador (localhost).
  database: {
    url: process.env.DATABASE_URL || fileConfig.database?.url || '',
    ownerUrl: process.env.DATABASE_OWNER_URL || fileConfig.database?.ownerUrl || '',
    port: Number(process.env.PG_PORT) || Number(fileConfig.database?.port) || 5433,
    dir: path.join(dataDir, 'postgres'),
    credentialsFile: path.join(dataDir, 'postgres-credenciais.json'),
  },
  // Chave dos dados pessoais cifrados. GUARDE UMA CÓPIA EM LOCAL SEGURO:
  // sem ela os dados (inclusive dos backups) não podem ser lidos.
  keyFile: path.join(dataDir, 'chave-dados.key'),
  // HTTPS é obrigatório (DCTIMBOTEC 31/002/2020, item 3.1.b). Só pode ser
  // desligado de forma explícita (ex.: TLS feito por um proxy do CLTI).
  // Certificado: o emitido pelo CTIM (cert/key em PEM ou arquivo .pfx);
  // sem ele, um certificado provisório é gerado em data/certs.
  https: {
    enabled: envFlag(process.env.HTTPS) ?? (fileConfig.https?.enabled !== false),
    cert: process.env.HTTPS_CERT || fileConfig.https?.cert || '',
    key: process.env.HTTPS_KEY || fileConfig.https?.key || '',
    pfx: process.env.HTTPS_PFX || fileConfig.https?.pfx || '',
    passphrase: process.env.HTTPS_PFX_SENHA || fileConfig.https?.passphrase || '',
  },
  certDir: path.join(dataDir, 'certs'),
  // "homologacao" mostra uma faixa de aviso em todas as telas (DCTIMARINST
  // 30-17, item 4.3: ambiente de teste separado e com dados fictícios).
  environment: (process.env.AMBIENTE || fileConfig.ambiente || 'producao').toLowerCase(),
  // Conta criada automaticamente na primeira execução, se não houver admin.
  adminEmail: process.env.ADMIN_EMAIL || 'admin@sisferias.local',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  sessionDays: Number(process.env.SESSION_DAYS) || 7,
  // Regra de senha da DCTIMBOTEC 31/002/2020, item 3.2.b.
  minPasswordLength: 10,
  // Tentativas seguidas de senha errada até a conta ser bloqueada (item 3.2.g).
  maxLoginAttempts: 5,
  // Custo do bcrypt (cada +1 dobra o tempo). 12 ≈ 0,3 s por login.
  bcryptCost: Number(process.env.BCRYPT_COST) || 12,
  // Minutos de inatividade até a área de Segurança pedir a senha de novo.
  elevationMinutes: Number(process.env.ELEVATION_MINUTES) || 15,
  // Quantidade de backups automáticos mantidos (os mais antigos são apagados).
  keepBackups: Number(process.env.KEEP_BACKUPS) || 30,
};
