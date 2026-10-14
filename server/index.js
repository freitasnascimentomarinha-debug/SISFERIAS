import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { seed } from './db.js'; // abre o banco e aplica as migrações
import { api } from './api.js';
import { loadSession, requireAppHeader, purgeExpiredSessions } from './auth.js';
import { scheduleDailyBackup } from './backup.js';
import { scheduleDeadlineCheck } from './deadline.js';
import { loadOrCreateCertificate, localAddresses } from './tls.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Limite alto por causa da importação de dados e de logos/fotos em base64.
app.use('/api', express.json({ limit: '100mb' }), loadSession, requireAppHeader, api);

if (fs.existsSync(path.join(config.distDir, 'index.html'))) {
  app.use(express.static(config.distDir, { index: false, maxAge: '1h' }));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(config.distDir, 'index.html')));
} else {
  app.get(/.*/, (_req, res) => res
    .status(503)
    .type('text/plain; charset=utf-8')
    .send('Interface não compilada. Execute "npm run build" e reinicie o servidor.'));
}

seed(); // configurações padrão e administrador inicial
purgeExpiredSessions();
setInterval(purgeExpiredSessions, 6 * 60 * 60_000).unref();
scheduleDailyBackup();
scheduleDeadlineCheck();

// HTTPS opcional (npm run https -- ativar). O certificado público pode ser
// baixado em /api/certificado para instalar nos computadores da rede.
const tls = config.https.enabled ? loadOrCreateCertificate() : null;
const server = tls
  ? https.createServer({ cert: tls.cert, key: tls.key }, app)
  : http.createServer(app);

server.listen(config.port, config.host, () => {
  const scheme = tls ? 'https' : 'http';
  console.log('SISFERIAS em execução.');
  console.log(`  Neste computador:  ${scheme}://localhost:${config.port}`);
  for (const ip of localAddresses()) console.log(`  Na rede:           ${scheme}://${ip}:${config.port}`);
  console.log(`  Banco de dados:    ${config.dbFile}`);
  if (tls) console.log(`  Certificado HTTPS: ${tls.file}`);
  console.log('Para encerrar, feche esta janela ou pressione Ctrl+C.');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nA porta ${config.port} já está em uso.`);
    console.error('O SISFERIAS provavelmente já está rodando neste computador (talvez como serviço).');
    console.error(`Abra http://localhost:${config.port} no navegador, ou feche a outra instância.\n`);
    process.exit(1);
  }
  throw err;
});
