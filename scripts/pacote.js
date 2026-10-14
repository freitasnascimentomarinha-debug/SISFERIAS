// Gera o pacote pronto para rodar SEM internet: pasta "pacote/sisferias"
// com a interface compilada e apenas as dependências de execução.
// Na máquina de destino basta ter o Node.js e executar iniciar.bat / iniciar.sh.
//
//   npm run pacote
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'pacote', 'sisferias');
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

console.log('Compilando a interface...');
run('npm run build');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const items = ['dist', 'server', 'scripts', 'package.json', 'package-lock.json',
  'iniciar.bat', 'iniciar.sh', 'README.md', 'INSTALACAO.md'];
for (const item of items) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}

console.log('Instalando dependências de execução...');
run('npm ci --omit=dev --ignore-scripts --no-audit --no-fund', out);

console.log(`\nPacote pronto em: ${out}`);
console.log('Compacte a pasta "sisferias" em .zip e copie para o servidor da rede interna.');
