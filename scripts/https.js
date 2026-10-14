// Liga ou desliga o HTTPS (conexão criptografada) do SISFERIAS.
//
//   npm run https -- ativar                         certificado gerado automaticamente
//   npm run https -- ativar --cert C:\certs\srv.crt --key C:\certs\srv.key   certificado da instituição
//   npm run https -- desativar
//   npm run https -- status
//
// A configuração fica em data/config.json. Depois de mudar, reinicie o
// SISFERIAS (feche e abra o iniciar.bat, ou reinicie o serviço).
import fs from 'node:fs';
import path from 'node:path';
import { readConfigFile, writeConfigFile, CONFIG_FILE } from '../server/config.js';

const args = process.argv.slice(2);
const command = args.find(a => !a.startsWith('--')) || 'status';
const arg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const current = readConfigFile();
const restartHint = 'Reinicie o SISFERIAS para valer (feche e abra o iniciar.bat, ou: npm run servico -- parar  e  npm run servico -- iniciar).';

if (command === 'ativar') {
  const cert = arg('cert');
  const key = arg('key');
  if ((cert && !key) || (!cert && key)) {
    console.error('Informe os dois arquivos: --cert e --key.');
    process.exit(1);
  }
  for (const f of [cert, key].filter(Boolean)) {
    if (!fs.existsSync(f)) { console.error(`Arquivo não encontrado: ${f}`); process.exit(1); }
  }
  const https = { enabled: true, ...(cert ? { cert: path.resolve(cert), key: path.resolve(key) } : {}) };
  writeConfigFile({ ...current, https });
  // Gera (ou confere) o certificado agora, para a próxima inicialização ser rápida.
  process.env.HTTPS = '1';
  if (cert) { process.env.HTTPS_CERT = https.cert; process.env.HTTPS_KEY = https.key; }
  const { loadOrCreateCertificate } = await import('../server/tls.js');
  const result = loadOrCreateCertificate();
  console.log(`\nHTTPS ativado (${CONFIG_FILE}).`);
  console.log(`Certificado: ${result.file}${cert ? ' (da instituição)' : ' (gerado automaticamente)'}`);
  console.log(restartHint);
  if (!cert) {
    console.log('\nPara os navegadores não mostrarem o aviso de "conexão não segura", instale o certificado');
    console.log('em cada computador: abra https://ENDERECO-DO-SERVIDOR:PORTA/api/certificado, salve o arquivo,');
    console.log('dê dois cliques > Instalar certificado > Máquina Local > "Autoridades de Certificação Raiz Confiáveis".');
    console.log('(A TI pode distribuir o mesmo arquivo para todos os computadores por política de grupo.)');
  }
} else if (command === 'desativar') {
  writeConfigFile({ ...current, https: { ...(current.https || {}), enabled: false } });
  console.log(`HTTPS desativado. ${restartHint}`);
} else if (command === 'status') {
  const h = current.https || {};
  console.log(h.enabled ? `HTTPS ativado${h.cert ? ` com certificado da instituição (${h.cert})` : ' com certificado automático (data/certs)'}.` : 'HTTPS desativado (conexão sem criptografia).');
} else {
  console.error('Uso: npm run https -- ativar [--cert arquivo.crt --key arquivo.key] | desativar | status');
  process.exit(1);
}
