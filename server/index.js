import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { connectDb, closeDb, seed, dbInfo } from './db.js';
import { api } from './api.js';
import { operationLogger } from './oplog.js';
import { loadSession, requireAppHeader, requirePasswordChanged, purgeExpiredSessions } from './auth.js';
import { scheduleDailyBackup } from './backup.js';
import { scheduleDeadlineCheck } from './deadline.js';
import { loadOrCreateCertificate, localAddresses } from './tls.js';

try {
  await connectDb(); // inicia/conecta o PostgreSQL, aplica migrações e confere a chave
  await seed(); // configurações padrão e administrador inicial
} catch (err) {
  console.error(`\nNão foi possível abrir o banco de dados:\n${err.message}\n`);
  await closeDb().catch(() => {});
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (config.https.enabled) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});

// Nenhuma resposta com dados é guardada pelo navegador (DCTIMBOTEC 31/002, item 3.1.d).
const noStore = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
};

// Limite alto por causa da importação de dados e de logos/fotos em base64.
app.use('/api', noStore, operationLogger, express.json({ limit: '100mb' }), loadSession, requireAppHeader, requirePasswordChanged, api);

if (fs.existsSync(path.join(config.distDir, 'index.html'))) {
  // Arquivos da interface (sem dados) podem ficar em cache; a página principal não.
  app.use(express.static(config.distDir, { index: false, maxAge: '1h' }));
  app.get(/.*/, noStore, (_req, res) => res.sendFile(path.join(config.distDir, 'index.html')));
} else {
  app.get(/.*/, (_req, res) => res
    .status(503)
    .type('text/plain; charset=utf-8')
    .send('Interface não compilada. Execute "npm run build" e reinicie o servidor.'));
}

const safely = (fn, what) => () => fn().catch(err => console.error(`[${what}]`, err.message));
await purgeExpiredSessions();
setInterval(safely(purgeExpiredSessions, 'sessões'), 6 * 60 * 60_000).unref();
scheduleDailyBackup();
scheduleDeadlineCheck();

// HTTPS (obrigatório pela DCTIMBOTEC 31/002). O certificado público
// provisório pode ser baixado em /api/certificado.
const tls = config.https.enabled ? loadOrCreateCertificate() : null;
const server = tls
  ? https.createServer({ ...tls.options, minVersion: 'TLSv1.2' }, app)
  : http.createServer(app);

server.listen(config.port, config.host, () => {
  const scheme = tls ? 'https' : 'http';
  console.log('SISFERIAS em execução.');
  console.log(`  Neste computador:  ${scheme}://localhost:${config.port}`);
  for (const ip of localAddresses()) console.log(`  Na rede:           ${scheme}://${ip}:${config.port}`);
  console.log(`  Banco de dados:    ${dbInfo.description}`);
  if (tls) console.log(`  Certificado HTTPS: ${tls.file}${tls.institutional ? '' : ' (provisório — use o certificado emitido pelo CTIM)'}`);
  if (config.environment !== 'producao') console.log(`  AMBIENTE:          ${config.environment.toUpperCase()} (use somente dados fictícios)`);
  if (!tls) {
    console.warn('\n  ATENÇÃO: HTTPS DESATIVADO. As senhas e os dados trafegam sem criptografia.');
    console.warn('  Isso só é aceitável se houver um proxy HTTPS na frente do SISFERIAS (INSTALACAO.md).\n');
  }
  console.log('Para encerrar, feche esta janela ou pressione Ctrl+C.');
});

server.on('error', async (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nA porta ${config.port} já está em uso.`);
    console.error('O SISFERIAS provavelmente já está rodando neste computador (talvez como serviço).');
    console.error(`Abra https://localhost:${config.port} no navegador, ou feche a outra instância.\n`);
    await closeDb({ stopEmbedded: 'if-started' });
    process.exit(1);
  }
  throw err;
});

// Encerramento: fecha as conexões e desliga o PostgreSQL embutido.
let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`\nEncerrando o SISFERIAS (${signal})...`);
  server.close();
  await closeDb().catch(err => console.error('[banco] ao encerrar:', err.message));
  process.exit(0);
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) process.on(signal, () => void shutdown(signal));
