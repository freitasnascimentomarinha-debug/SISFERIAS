// Modo serviço: mantém o servidor rodando sem janela.
//
// - grava tudo o que o servidor escreveria na tela em data/logs/sisferias.log
//   (o arquivo é renovado ao passar de 5 MB, guardando o anterior como .1);
// - se o servidor parar por erro, inicia de novo após 5 segundos.
//
// Usado pelo serviço do Windows (scripts/servico.js) e pelo systemd no Linux.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const logDir = path.join(config.dataDir, 'logs');
const logFile = path.join(logDir, 'sisferias.log');
const MAX_LOG = 5 * 1024 * 1024;
fs.mkdirSync(logDir, { recursive: true });

function log(text) {
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_LOG) {
      fs.renameSync(logFile, `${logFile}.1`);
    }
    fs.appendFileSync(logFile, text);
  } catch { /* sem log, mas o servidor continua */ }
}
const stamp = () => new Date().toLocaleString('pt-BR');

const startScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'start.js');
let child = null;
let stopping = false;
let restarts = 0;

function run() {
  log(`\n[${stamp()}] Iniciando o SISFERIAS (serviço)...\n`);
  child = spawn(process.execPath, [startScript], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => log(d.toString()));
  child.stderr.on('data', d => log(d.toString()));
  const startedAt = Date.now();
  child.on('exit', (code, signal) => {
    if (stopping) return;
    // Se caiu logo após iniciar várias vezes seguidas, espera mais para não ficar em laço.
    restarts = Date.now() - startedAt < 30_000 ? restarts + 1 : 0;
    const wait = Math.min(5_000 * 2 ** Math.max(0, restarts - 1), 5 * 60_000);
    log(`[${stamp()}] O servidor parou (código ${code ?? signal}). Nova tentativa em ${Math.round(wait / 1000)} s.\n`);
    setTimeout(run, wait);
  });
}

function stop() {
  stopping = true;
  log(`[${stamp()}] Serviço encerrado.\n`);
  if (child) child.kill();
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

run();
