// Administração do banco de dados PostgreSQL.
//
//   npm run banco -- status
//       Mostra qual banco está em uso e quantos registros há em cada tabela.
//
//   npm run banco -- preparar --url postgres://SUPERUSUARIO:SENHA@SERVIDOR:5432/postgres [--banco sisferias]
//       Usa um PostgreSQL externo (ex.: servidor do CLTI). Com o superusuário
//       (ou um usuário com CREATEROLE/CREATEDB), cria o banco, o usuário DONO
//       (migrações) e o usuário da APLICAÇÃO (só dados), com senhas aleatórias,
//       e grava a configuração em data/config.json. A senha do superusuário
//       não é guardada.
//
//   npm run banco -- configurar --url postgres://APP:SENHA@SERVIDOR/BANCO [--dono-url postgres://DONO:SENHA@SERVIDOR/BANCO]
//       Quando o DBA já criou o banco e os usuários: só grava a configuração.
//
//   npm run banco -- embutido
//       Volta a usar o PostgreSQL embutido (data/postgres).
//
//   npm run banco -- migrar-sqlite [arquivo.db]
//       Copia os dados de um banco SQLite das versões 2.x (feito
//       automaticamente na primeira execução, se data/sisferias.db existir).
//
//   npm run banco -- parar
//       Desliga o PostgreSQL embutido (o SISFERIAS deve estar fechado).
import crypto from 'node:crypto';
import { readConfigFile, writeConfigFile, CONFIG_FILE, config } from '../server/config.js';

const args = process.argv.slice(2);
const command = args.find(a => !a.startsWith('--')) || 'status';
const arg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const mask = (url) => url.replace(/:\/\/([^:@/]+):[^@]*@/, '://$1:****@');
const restartHint = 'Reinicie o SISFERIAS para valer (feche e abra o iniciar.bat, ou reinicie o serviço).';

async function status() {
  const { connectDb, closeDb, dbInfo } = await import('../server/db.js');
  const { countAll } = await import('../server/importer.js');
  await connectDb();
  try {
    console.log(`Banco: ${dbInfo.description}`);
    console.log(`Usuário da aplicação: ${dbInfo.appRole} ${dbInfo.leastPrivilege ? '(privilégio mínimo: só lê/grava dados)' : '(ATENÇÃO: mesmo usuário do dono do banco)'}`);
    console.log(`Chave dos dados pessoais: ${process.env.SISFERIAS_CHAVE ? 'variável SISFERIAS_CHAVE' : config.keyFile}`);
    console.log('Registros:');
    for (const [t, n] of Object.entries(await countAll())) console.log(`  ${t.padEnd(18)} ${n}`);
  } finally {
    await closeDb({ stopEmbedded: 'if-started' });
  }
}

async function preparar() {
  const superUrl = arg('url');
  if (!superUrl) throw new Error('Informe --url postgres://SUPERUSUARIO:SENHA@SERVIDOR:5432/postgres');
  const database = arg('banco') || 'sisferias';
  const ownerRole = arg('dono') || `${database}_dono`;
  const appRole = arg('app') || `${database}_app`;
  const { createRolesAndDatabase } = await import('../server/pgembed.js');
  const ownerPassword = crypto.randomBytes(24).toString('base64url');
  const appPassword = crypto.randomBytes(24).toString('base64url');
  await createRolesAndDatabase(superUrl, { ownerPassword, appPassword, database, ownerRole, appRole });
  const base = new URL(superUrl);
  const urlFor = (role, password) => {
    const u = new URL(base.toString());
    u.username = role;
    u.password = password;
    u.pathname = `/${database}`;
    return u.toString();
  };
  const url = urlFor(appRole, appPassword);
  const ownerUrl = urlFor(ownerRole, ownerPassword);
  writeConfigFile({ ...readConfigFile(), database: { url, ownerUrl } });
  console.log(`Banco "${database}" preparado em ${base.hostname}:${base.port || 5432}.`);
  console.log(`  Dono (migrações):     ${ownerRole}`);
  console.log(`  Aplicação (dados):    ${appRole}`);
  console.log(`Configuração gravada em ${CONFIG_FILE} (contém as senhas: proteja este arquivo).`);
  console.log(restartHint);
}

function configurar() {
  const url = arg('url');
  if (!url) throw new Error('Informe --url postgres://USUARIO_APP:SENHA@SERVIDOR:5432/BANCO');
  const ownerUrl = arg('dono-url') || '';
  writeConfigFile({ ...readConfigFile(), database: { url, ownerUrl } });
  console.log(`Banco externo configurado: ${mask(url)}${ownerUrl ? `  (dono: ${mask(ownerUrl)})` : ''}`);
  console.log(restartHint);
}

function embutido() {
  const current = readConfigFile();
  delete current.database;
  writeConfigFile(current);
  console.log(`Configurado para usar o PostgreSQL embutido (${config.database.dir}). ${restartHint}`);
}

async function migrarSqlite() {
  const { connectDb, closeDb } = await import('../server/db.js');
  const { migrateLegacySqlite } = await import('../server/legacy.js');
  const file = args.filter(a => !a.startsWith('--'))[1] || config.legacySqliteFile;
  await connectDb();
  try {
    const counts = await migrateLegacySqlite({ file, force: true });
    if (!counts) console.log(`Arquivo não encontrado: ${file}`);
  } finally {
    await closeDb({ stopEmbedded: 'if-started' });
  }
}

async function parar() {
  const { stopEmbeddedCluster } = await import('../server/pgembed.js');
  console.log(await stopEmbeddedCluster() ? 'PostgreSQL embutido desligado.' : 'O PostgreSQL embutido não estava ligado.');
}

const commands = { status, preparar, configurar, embutido, 'migrar-sqlite': migrarSqlite, parar };
if (!commands[command]) {
  console.error('Uso: npm run banco -- status | preparar --url ... | configurar --url ... | embutido | migrar-sqlite [arquivo] | parar');
  process.exit(1);
}
try {
  await commands[command]();
} catch (err) {
  console.error(`Erro: ${err.message}`);
  process.exit(1);
}
