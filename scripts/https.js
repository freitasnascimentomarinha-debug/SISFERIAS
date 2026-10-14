// HTTPS (conexão criptografada) do SISFERIAS. Vem ATIVADO por padrão
// (DCTIMBOTEC 31/002/2020, item 3.1.b), com um certificado provisório.
//
//   npm run https -- ativar --cert C:\certs\srv.crt --key C:\certs\srv.key   certificado do CTIM (PEM)
//   npm run https -- ativar --pfx C:\certs\srv.pfx --senha SENHA_DO_PFX          certificado do CTIM (.pfx/.p12)
//   npm run https -- ativar                          volta ao certificado provisório
//   npm run https -- desativar                       SOMENTE com proxy HTTPS na frente
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
  const pfx = arg('pfx');
  if ((cert && !key) || (!cert && key)) {
    console.error('Informe os dois arquivos: --cert e --key.');
    process.exit(1);
  }
  for (const f of [cert, key, pfx].filter(Boolean)) {
    if (!fs.existsSync(f)) { console.error(`Arquivo não encontrado: ${f}`); process.exit(1); }
  }
  const https = {
    enabled: true,
    ...(cert ? { cert: path.resolve(cert), key: path.resolve(key) } : {}),
    ...(pfx ? { pfx: path.resolve(pfx), passphrase: arg('senha') || '' } : {}),
  };
  // Gera (ou confere) o certificado agora, para a próxima inicialização ser rápida.
  process.env.HTTPS = '1';
  process.env.HTTPS_CERT = https.cert || '';
  process.env.HTTPS_KEY = https.key || '';
  process.env.HTTPS_PFX = https.pfx || '';
  process.env.HTTPS_PFX_SENHA = https.passphrase || '';
  const { loadOrCreateCertificate } = await import('../server/tls.js');
  const result = loadOrCreateCertificate();
  if (pfx) {
    // Confere se o .pfx abre com a senha informada.
    const tlsMod = await import('node:tls');
    try { tlsMod.createSecureContext(result.options); } catch (err) {
      console.error(`Não foi possível abrir o certificado .pfx: ${err.message}`);
      process.exit(1);
    }
  }
  writeConfigFile({ ...current, https });
  console.log(`\nHTTPS ativado (${CONFIG_FILE}).`);
  console.log(`Certificado: ${result.file}${result.institutional ? ' (da instituição)' : ' (provisório, gerado automaticamente)'}`);
  console.log(restartHint);
  if (!result.institutional) {
    console.log('\nPara os navegadores não mostrarem o aviso de "conexão não segura", instale o certificado');
    console.log('em cada computador: abra https://ENDERECO-DO-SERVIDOR:PORTA/api/certificado, salve o arquivo,');
    console.log('dê dois cliques > Instalar certificado > Máquina Local > "Autoridades de Certificação Raiz Confiáveis".');
    console.log('(A TI pode distribuir o mesmo arquivo para todos os computadores por política de grupo.)');
  }
} else if (command === 'desativar') {
  writeConfigFile({ ...current, https: { ...(current.https || {}), enabled: false } });
  console.log(`HTTPS desativado. ${restartHint}`);
  console.log('ATENÇÃO: a DCTIMBOTEC 31/002/2020 (item 3.1.b) exige HTTPS. Desative somente se um proxy');
  console.log('HTTPS (ex.: do CLTI) estiver na frente do SISFERIAS e a rede até ele for protegida.');
} else if (command === 'status') {
  const h = current.https || {};
  const enabled = h.enabled !== false;
  const which = h.pfx ? ` com certificado da instituição (${h.pfx})` : h.cert ? ` com certificado da instituição (${h.cert})` : ' com certificado PROVISÓRIO (data/certs) — instale o certificado do CTIM';
  console.log(enabled ? `HTTPS ativado${which}.` : 'HTTPS desativado (conexão sem criptografia).');
} else {
  console.error('Uso: npm run https -- ativar [--cert arquivo.crt --key arquivo.key] | desativar | status');
  process.exit(1);
}
