// Certificado para HTTPS.
//
// DCTIMBOTEC 31/002/2020, item 3.1.c: na RECIM, o certificado do servidor
// deve ser emitido pelo CTIM. Ele é configurado com "npm run https -- ativar"
// (arquivos .crt/.key em PEM ou um arquivo .pfx/.p12 com senha).
// Enquanto isso, o sistema gera um certificado PROVISÓRIO em data/certs/, válido para
// "localhost", para o nome do computador e para todos os seus endereços IP.
// Se o servidor ganhar um IP novo, o certificado é refeito na próxima
// inicialização.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import forge from 'node-forge';
import { config } from './config.js';

export const autoCertFile = () => path.join(config.certDir, 'sisferias.crt');
const autoKeyFile = () => path.join(config.certDir, 'sisferias.key');

/** Endereços IPv4 deste computador (exceto internos). */
export function localAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal)
    .map(i => i.address);
}

function generateCertificate(ips, hostnames) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = `01${forge.util.bytesToHex(forge.random.getBytesSync(15))}`;
  cert.validity.notBefore = new Date(Date.now() - 24 * 3600_000);
  cert.validity.notAfter = new Date(Date.now() + 5 * 365 * 24 * 3600_000); // 5 anos
  const attrs = [
    { name: 'commonName', value: `SISFERIAS (${hostnames[0]})` },
    { name: 'organizationName', value: 'SISFERIAS - rede interna' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, keyCertSign: true },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        ...hostnames.map(value => ({ type: 2, value })),
        ...['127.0.0.1', ...ips].map(ip => ({ type: 7, ip })),
      ],
    },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert: forge.pki.certificateToPem(cert), key: forge.pki.privateKeyToPem(keys.privateKey) };
}

/** Lista os IPs presentes no certificado. */
function certificateIps(pem) {
  try {
    const cert = forge.pki.certificateFromPem(pem);
    const san = cert.getExtension('subjectAltName');
    return (san?.altNames || []).filter(n => n.type === 7).map(n => n.ip);
  } catch {
    return [];
  }
}

/**
 * Devolve { options, file, generated, institutional } para o servidor HTTPS,
 * gerando o certificado provisório se necessário.
 */
export function loadOrCreateCertificate({ force = false } = {}) {
  if (config.https.pfx) {
    return {
      options: { pfx: fs.readFileSync(config.https.pfx), passphrase: config.https.passphrase || undefined },
      file: config.https.pfx,
      generated: false,
      institutional: true,
    };
  }
  if (config.https.cert && config.https.key) {
    return {
      options: { cert: fs.readFileSync(config.https.cert, 'utf8'), key: fs.readFileSync(config.https.key, 'utf8') },
      file: config.https.cert,
      generated: false,
      institutional: true,
    };
  }
  const ips = localAddresses();
  const hostnames = [...new Set([os.hostname(), 'localhost'])];
  const certFile = autoCertFile();
  const keyFile = autoKeyFile();
  if (!force && fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    const cert = fs.readFileSync(certFile, 'utf8');
    const missing = ips.filter(ip => !certificateIps(cert).includes(ip));
    if (!missing.length) return { options: { cert, key: fs.readFileSync(keyFile, 'utf8') }, file: certFile, generated: false, institutional: false };
    console.log(`[https] novo endereço de rede (${missing.join(', ')}): gerando um novo certificado.`);
  }
  console.log('[https] gerando certificado do servidor (pode levar alguns segundos)...');
  const { cert, key } = generateCertificate(ips, hostnames);
  fs.mkdirSync(config.certDir, { recursive: true });
  fs.writeFileSync(certFile, cert);
  fs.writeFileSync(keyFile, key, { mode: 0o600 });
  return { options: { cert, key }, file: certFile, generated: true, institutional: false };
}
