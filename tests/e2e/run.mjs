// Executa os testes de navegador (e2e) com 5 contas, do zero.
//
//   npm run test:e2e
//
// Requer o Playwright com o Chromium (só na primeira vez):
//   npm install --no-save playwright && npx playwright install chromium
//
// Sobe um servidor isolado em uma pasta temporária, roda as etapas em ordem
// (reiniciando o servidor no meio para testar a persistência) e mostra o
// resultado. Capturas de tela e detalhes ficam na pasta indicada ao final.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from '../helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sisferias-e2e-'));
const dataDir = path.join(dir, 'data');
const serverLog = path.join(dir, 'servidor.log');
const env = { ADMIN_PASSWORD: 'Admin@123' };

const steps = [
  ['t1_contas', 'Cadastro, login e papéis'],
  ['t2_ferias', 'Lançamentos de férias'],
  ['t3_admin', 'Funções de administrador'],
  ['t3b_refazer', 'Papeleta, Trâmite, avisos e sugestões'],
  ['t4a_persist', 'Gravações simultâneas e imagens'],
  ['--reiniciar--', 'Reinício do servidor'],
  ['t4b_restart', 'Persistência após reiniciar'],
  ['t5_correcoes', 'Papeleta offline, prazo, auditoria, atualização, Quadro/Esp.'],
  ['t6_bloqueado', 'Admin edita lançamento de bloqueado'],
  ['t7_pacote', 'Troca de senha, regra de senha, ajustes de tela e cópia de backups'],
  ['t8_excel_https', 'Excel, redução de imagens, aba removida, telas sob demanda e HTTPS'],
];

let srv = await startServer({ dataDir, env });
const summary = [];
for (const [step, label] of steps) {
  if (step === '--reiniciar--') {
    await srv.stop();
    srv = await startServer({ dataDir, port: srv.port, env: {} });
    fs.writeFileSync(serverLog, srv.output());
    console.log('\n=== Servidor reiniciado ===');
    continue;
  }
  console.log(`\n=== ${label} (${step}) ===`);
  const r = spawnSync(process.execPath, [path.join(HERE, `${step}.mjs`)], {
    stdio: 'inherit',
    env: { ...process.env, E2E_BASE: srv.base, E2E_DIR: dir, E2E_SERVER_LOG: serverLog },
  });
  if (r.status === 2) process.exit(2); // Playwright ausente
  summary.push(step);
}
await srv.stop();

const results = fs.readdirSync(dir)
  .filter(f => /^r.*\.json$/.test(f))
  .flatMap(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const failed = results.filter(r => !r.ok);
console.log('\n' + '='.repeat(60));
console.log(`RESULTADO: ${results.length - failed.length} de ${results.length} verificações aprovadas`);
for (const f of failed) console.log(`  FALHOU [${f.section}] ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
console.log(`Detalhes e capturas de tela: ${dir}`);
console.log('='.repeat(60));
process.exitCode = failed.length ? 1 : 0;
