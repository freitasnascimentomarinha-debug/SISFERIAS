// Criptografia dos dados pessoais e das senhas.
//
// DCTIMBOTEC 31/002/2020, item 3.3, e DCTIMARINST 30-17, item 4.5: os dados
// pessoais ficam cifrados no banco (AES-256-GCM). Quem tiver acesso apenas ao
// banco (ou a um backup dele) não consegue lê-los sem a chave, que fica fora
// do banco: em data/chave-dados.key ou na variável SISFERIAS_CHAVE.
//
// Para buscas por igualdade (login por NIP ou e-mail, NIP/e-mail repetido)
// guardamos ao lado um "índice cego": HMAC-SHA256 do valor normalizado, que
// permite comparar sem revelar o conteúdo.
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

const PREFIX = 'enc:v1:';
let encKey = null;
let macKey = null;

/** Lê a chave mestra (32 bytes). Com `create`, gera uma nova se não existir. */
export function loadMasterKey({ create = false } = {}) {
  const fromEnv = process.env.SISFERIAS_CHAVE;
  if (fromEnv) {
    const key = Buffer.from(fromEnv.trim(), 'base64');
    if (key.length !== 32) throw new Error('SISFERIAS_CHAVE deve ter 32 bytes em base64.');
    return { key, created: false, source: 'variável SISFERIAS_CHAVE' };
  }
  if (fs.existsSync(config.keyFile)) {
    const key = Buffer.from(fs.readFileSync(config.keyFile, 'utf8').trim(), 'base64');
    if (key.length !== 32) throw new Error(`Arquivo de chave inválido: ${config.keyFile}`);
    return { key, created: false, source: config.keyFile };
  }
  if (!create) return null;
  const key = crypto.randomBytes(32);
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(config.keyFile, key.toString('base64') + '\n', { mode: 0o600 });
  return { key, created: true, source: config.keyFile };
}

/** Deriva as subchaves de cifragem e de índice a partir da chave mestra. */
export function useMasterKey(master) {
  encKey = Buffer.from(crypto.hkdfSync('sha256', master, Buffer.alloc(0), 'sisferias-cifra', 32));
  macKey = Buffer.from(crypto.hkdfSync('sha256', master, Buffer.alloc(0), 'sisferias-indice', 32));
}

/** Identificador da chave (não revela a chave), gravado no banco para detectar troca. */
export const keyFingerprint = () =>
  crypto.createHmac('sha256', macKey).update('sisferias-verificacao-da-chave').digest('hex').slice(0, 32);

const needKey = () => { if (!encKey) throw new Error('Chave de criptografia não carregada.'); };

export const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);

export function encrypt(plain) {
  if (plain === null || plain === undefined) return plain;
  needKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

export function decrypt(value) {
  if (!isEncrypted(value)) return value; // valor antigo, ainda sem cifra
  needKey();
  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

/** Índice cego para buscas por igualdade (sem diferenciar maiúsculas). */
export function blindIndex(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  needKey();
  return crypto.createHmac('sha256', macKey).update(normalized).digest('hex');
}

// ---------------------------------------------------------------------------
// Senhas (DCTIMBOTEC 31/002/2020, itens 3.2.b e 3.2.c)
// ---------------------------------------------------------------------------

export const PASSWORD_RULE_TEXT =
  'mínimo de 10 caracteres, com letras maiúsculas, letras minúsculas, números e caracteres especiais';

/** Lista o que falta na senha para atender à regra (vazia = senha aceita). */
export function passwordProblems(password) {
  const p = String(password ?? '');
  const missing = [];
  if (p.length < config.minPasswordLength) missing.push(`pelo menos ${config.minPasswordLength} caracteres`);
  if (!/[A-Z]/.test(p)) missing.push('uma letra maiúscula');
  if (!/[a-z]/.test(p)) missing.push('uma letra minúscula');
  if (!/[0-9]/.test(p)) missing.push('um número');
  if (!/[^A-Za-z0-9]/.test(p)) missing.push('um caractere especial (ex.: @ # $ %)');
  return missing;
}

// O hash combina o ID do usuário com a senha (SHA-256) e aplica bcrypt, que
// acrescenta um salt aleatório e é lento de propósito contra força bruta.
// O SHA-256 prévio também elimina o limite de 72 bytes do bcrypt, de modo
// que a senha não tem tamanho máximo.
const HASH_PREFIX = 'sf2$';
const preHash = (userId, plain) =>
  crypto.createHash('sha256').update(`${userId}:${plain}`, 'utf8').digest('base64');

export async function hashPassword(userId, plain) {
  return HASH_PREFIX + await bcrypt.hash(preHash(userId, plain), config.bcryptCost);
}

/** Confere a senha. Aceita também hashes bcrypt antigos (importados). */
export async function verifyPassword(userId, plain, hash) {
  if (!hash) {
    // Conta inexistente ou sem senha: gasta o mesmo tempo de uma conta real,
    // para o tempo de resposta não revelar quais contas existem.
    dummyHash ??= bcrypt.hashSync('sisferias', config.bcryptCost);
    await bcrypt.compare('x', dummyHash);
    return false;
  }
  try {
    if (hash.startsWith(HASH_PREFIX)) return await bcrypt.compare(preHash(userId, plain), hash.slice(HASH_PREFIX.length));
    // Hashes "$2y$" (PHP) são equivalentes a "$2a$".
    const normalized = hash.startsWith('$2y$') ? `$2a$${hash.slice(4)}` : hash;
    return await bcrypt.compare(plain, normalized);
  } catch {
    return false;
  }
}
let dummyHash = null;

/** Hash no formato antigo, que deve ser refeito no próximo login. */
export const isLegacyHash = (hash) => !!hash && !hash.startsWith(HASH_PREFIX);

export const isValidHashFormat = (hash) =>
  /^\$2[aby]\$\d{2}\$/.test(hash) || (hash.startsWith(HASH_PREFIX) && /^\$2[aby]\$\d{2}\$/.test(hash.slice(HASH_PREFIX.length)));
