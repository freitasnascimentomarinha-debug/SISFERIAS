// Gera o pacote pronto para rodar SEM internet: pasta "pacote/sisferias"
// com a interface compilada, as dependências de execução e os binários do
// PostgreSQL embutido da plataforma de destino. Na máquina de destino basta
// ter o Node.js e executar iniciar.bat / iniciar.sh.
//
//   npm run pacote                         para a plataforma deste computador
//   npm run pacote -- --plataforma windows (ou linux)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'pacote', 'sisferias');
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });
const args = process.argv.slice(2);
const i = args.indexOf('--plataforma');
const target = i >= 0 ? args[i + 1] : (process.platform === 'win32' ? 'windows' : process.platform);
const os = { windows: 'win32', win32: 'win32', linux: 'linux' }[target];
if (!os) {
  console.error('Plataforma inválida. Use: --plataforma windows | linux');
  process.exit(1);
}

console.log('Compilando a interface...');
run('npm run build');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const items = ['dist', 'server', 'scripts', 'package.json', 'package-lock.json',
  'iniciar.bat', 'iniciar.sh', 'instalar-servico.bat', 'remover-servico.bat',
  'README.md', 'INSTALACAO.md', 'CONFORMIDADE.md'];
for (const item of items) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}

console.log(`Instalando dependências de execução (${os}-x64)...`);
// --os/--cpu: baixa os binários do PostgreSQL da plataforma de destino.
run(`npm ci --omit=dev --os=${os} --cpu=x64 --no-audit --no-fund`, out);
const pgPackage = os === 'win32' ? 'windows-x64' : 'linux-x64';
if (!fs.existsSync(path.join(out, 'node_modules', '@embedded-postgres', pgPackage))) {
  console.error(`Os binários do PostgreSQL (${pgPackage}) não foram instalados.`);
  process.exit(1);
}

console.log(`\nPacote pronto em: ${out} (${target})`);
console.log('Compacte a pasta "sisferias" em .zip e copie para o servidor da rede interna.');
