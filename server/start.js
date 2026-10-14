// Ponto de entrada: confere a versão do Node antes de carregar o servidor.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\nO SISFERIAS precisa do Node.js 22.13 ou mais recente (instalado: ${process.versions.node}).`);
  console.error('Baixe a versão LTS em https://nodejs.org e execute novamente.\n');
  process.exit(1);
}

// O módulo node:sqlite (usado só para migrar dados das versões 2.x) ainda emite
// um aviso "experimental"; os demais avisos continuam visíveis.
process.removeAllListeners('warning');
process.on('warning', (w) => {
  if (w.name !== 'ExperimentalWarning') console.warn(w);
});

const target = {
  admin: '../scripts/admin.js',        // npm run admin -- --senha X
  backup: '../scripts/backup.js',      // npm run backup
  restaurar: '../scripts/restaurar.js', // npm run restaurar -- arquivo.json
  banco: '../scripts/banco.js',        // npm run banco -- status
  'dados-ficticios': '../scripts/dados-ficticios.js', // npm run dados-ficticios
  servico: './supervisor.js',          // modo serviço (sem janela, reinicia se cair)
}[process.argv[2]];
if (target) process.argv.splice(2, 1); // o script recebe só os próprios argumentos
await import(target || './index.js');
