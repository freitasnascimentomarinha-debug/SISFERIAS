// Gera o pacote pronto para rodar SEM internet: pasta "pacote/sisferias"
// com a interface compilada, as dependências de execução e os binários do
// PostgreSQL embutido da plataforma de destino e o próprio Node.js (pasta
// runtime). Na máquina de destino não é preciso instalar nada: basta executar
// iniciar.bat / iniciar.sh, ou os instaladores (Windows .exe, Ubuntu .deb).
//
//   npm run pacote                         para a plataforma deste computador
//   npm run pacote -- --plataforma windows (ou linux)
//   --sem-node                             não embute o Node.js (usa o do computador)
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
  'instalar.sh', 'desinstalar.sh', 'sisferias', 'sisferias.cmd', 'README.md', 'INSTALACAO.md', 'CONFORMIDADE.md'];
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

if (!args.includes('--sem-node')) await embedNode();

console.log(`\nPacote pronto em: ${out} (${target})`);
console.log('Compacte a pasta "sisferias" em .zip e copie para o servidor da rede interna.');

// Node.js oficial (nodejs.org) da mesma versão usada para gerar o pacote,
// conferido pelo SHA-256 publicado. Fica em runtime/ (Windows: runtime\node.exe;
// Linux: runtime/bin/node) e os scripts do pacote o usam no lugar do Node do computador.
async function embedNode() {
  const version = process.version;
  const file = os === 'win32' ? `node-${version}-win-x64.zip` : `node-${version}-linux-x64.tar.xz`;
  const base = `https://nodejs.org/dist/${version}`;
  const cacheDir = path.join(root, 'pacote', 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const archive = path.join(cacheDir, file);
  const sums = await (await fetch(`${base}/SHASUMS256.txt`)).text();
  const expected = sums.split('\n').find(l => l.endsWith(`  ${file}`))?.split(/\s+/)[0];
  if (!expected) throw new Error(`SHA-256 de ${file} não encontrado em ${base}/SHASUMS256.txt`);
  const { createHash } = await import('node:crypto');
  const sha = (buf) => createHash('sha256').update(buf).digest('hex');
  if (!fs.existsSync(archive) || sha(fs.readFileSync(archive)) !== expected) {
    console.log(`Baixando o Node.js ${version} (${file})...`);
    const res = await fetch(`${base}/${file}`);
    if (!res.ok) throw new Error(`Falha ao baixar ${file}: HTTP ${res.status}`);
    fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
  }
  if (sha(fs.readFileSync(archive)) !== expected) throw new Error(`SHA-256 de ${file} não confere.`);
  const tmp = path.join(cacheDir, 'extrair');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  run(os === 'win32' ? `unzip -q "${archive}" -d "${tmp}"` : `tar -xJf "${archive}" -C "${tmp}"`);
  const src = path.join(tmp, file.replace(/\.(zip|tar\.xz)$/, ''));
  const dest = path.join(out, 'runtime');
  fs.rmSync(dest, { recursive: true, force: true });
  if (os === 'win32') {
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(path.join(src, 'node.exe'), path.join(dest, 'node.exe'));
  } else {
    fs.mkdirSync(path.join(dest, 'bin'), { recursive: true });
    fs.copyFileSync(path.join(src, 'bin', 'node'), path.join(dest, 'bin', 'node'));
    fs.chmodSync(path.join(dest, 'bin', 'node'), 0o755);
  }
  fs.copyFileSync(path.join(src, 'LICENSE'), path.join(dest, 'LICENSE-nodejs.txt'));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Node.js ${version} embutido em runtime/.`);
}
