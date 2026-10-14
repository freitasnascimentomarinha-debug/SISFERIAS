import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { seed } from './db.js'; // abre o banco e aplica as migrações
import { api } from './api.js';
import { loadSession, requireAppHeader, purgeExpiredSessions } from './auth.js';
import { scheduleDailyBackup } from './backup.js';

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

app.listen(config.port, config.host, () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal)
    .map(i => `http://${i.address}:${config.port}`);
  console.log('SISFERIAS em execução.');
  console.log(`  Neste computador:  http://localhost:${config.port}`);
  for (const a of addresses) console.log(`  Na rede:           ${a}`);
  console.log(`  Banco de dados:    ${config.dbFile}`);
  console.log('Para encerrar, feche esta janela ou pressione Ctrl+C.');
});
