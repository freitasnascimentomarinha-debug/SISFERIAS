import crypto from 'node:crypto';
import { one, run, rowOut, addAudit } from './db.js';
import { config } from './config.js';
import { verifyPassword, isLegacyHash, hashPassword } from './crypto.js';

const COOKIE = 'sisferias_session';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 86400_000);
  await run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    [sha256(token), userId, expires.toISOString()]);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.https.enabled, // com HTTPS o cookie só trafega criptografado
    expires,
    path: '/',
  });
}

export async function destroySession(req, res) {
  const token = readCookie(req);
  if (token) await run('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
  res.clearCookie(COOKIE, { path: '/' });
}

export async function destroyUserSessions(userId, { exceptTokenHash = null } = {}) {
  await run('DELETE FROM sessions WHERE user_id = ? AND token_hash IS DISTINCT FROM ?', [userId, exceptTokenHash]);
}

function readCookie(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

/** Carrega `req.user` (perfil do usuário logado) quando houver sessão válida. */
export async function loadSession(req, _res, next) {
  try {
    const token = readCookie(req);
    if (token) {
      const tokenHash = sha256(token);
      const row = await one(`
        SELECT p.*, s.elevated_until AS _elevated_until, a.must_change_password AS _must_change
        FROM sessions s
        JOIN profiles p ON p.id = s.user_id
        JOIN auth_users a ON a.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > now() AND a.locked_at IS NULL`, [tokenHash]);
      if (row) {
        req.user = { ...rowOut('profiles', row), must_change_password: !!row._must_change };
        req.session = { tokenHash, elevatedUntil: row._elevated_until };
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem executar esta ação.' });
  next();
}

// Enquanto a senha for provisória, só é possível trocá-la (DCTIMBOTEC 31/002, item 3.2.d).
const ALLOWED_WITH_TEMP_PASSWORD = new Set(['/auth/me', '/auth/logout', '/auth/password', '/health', '/ambiente']);
export function requirePasswordChanged(req, res, next) {
  if (req.user?.must_change_password && !ALLOWED_WITH_TEMP_PASSWORD.has(req.path)) {
    return res.status(403).json({ error: 'Defina uma nova senha para continuar.', code: 'password_change_required' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Área de Segurança: o administrador confirma a própria senha e ganha um
// período de acesso que se renova a cada ação e expira por inatividade.
// ---------------------------------------------------------------------------

export const isElevated = (req) =>
  !!req.session?.elevatedUntil && req.session.elevatedUntil > new Date().toISOString();

export async function elevateSession(req) {
  const until = new Date(Date.now() + config.elevationMinutes * 60_000).toISOString();
  await run('UPDATE sessions SET elevated_until = ? WHERE token_hash = ?', [until, req.session.tokenHash]);
  req.session.elevatedUntil = until;
  return until;
}

export async function endElevation(req) {
  if (!req.session) return;
  await run('UPDATE sessions SET elevated_until = NULL WHERE token_hash = ?', [req.session.tokenHash]);
  req.session.elevatedUntil = null;
}

/** Administrador com "Visão Global" que gerencia o sistema (Departamento de Pessoal).
 *  O perfil de consulta (read_only, Direção) vê toda a OM, mas não gerencia nada. */
export const isGlobalAdmin = (req) => req.user?.role === 'admin' && !!req.user?.view_all_sectors && !req.user?.read_only;
/** Vê toda a OM: administrador com Visão Global, inclusive o de consulta. */
export const seesAllSectors = (req) => req.user?.role === 'admin' && !!req.user?.view_all_sectors;
export const GLOBAL_ONLY = 'Área de Segurança restrita aos administradores com Visão Global (Departamento de Pessoal).';

/** Administrador com Visão Global. O encarregado de setor não gerencia o sistema. */
export function requireGlobalAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem executar esta ação.' });
  if (!isGlobalAdmin(req)) return res.status(403).json({ error: GLOBAL_ONLY, code: 'global_admin_required' });
  next();
}

/** Admin com Visão Global e a senha confirmada recentemente. Cada uso renova o prazo. */
export async function requireElevated(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem executar esta ação.' });
  if (!isGlobalAdmin(req)) return res.status(403).json({ error: GLOBAL_ONLY, code: 'global_admin_required' });
  if (!isElevated(req)) {
    return res.status(403).json({
      error: 'Por segurança, confirme sua senha para continuar.',
      code: 'reauth_required',
    });
  }
  try {
    await elevateSession(req);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Proteção contra requisições forjadas por outros sites: toda requisição que
 * altera dados precisa do cabeçalho enviado pelo próprio front-end.
 */
export function requireAppHeader(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (req.get('X-Requested-With') !== 'sisferias') {
    return res.status(403).json({ error: 'Requisição recusada.' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Conferência de senha com bloqueio da conta (DCTIMBOTEC 31/002, item 3.2.g)
// ---------------------------------------------------------------------------

/**
 * Confere a senha de uma conta. Cada erro seguido conta uma tentativa; ao
 * atingir o limite a conta é bloqueada até um administrador liberá-la.
 * Retorna 'ok', 'invalid' ou 'locked' (a conta já estava bloqueada).
 */
export async function checkAccountPassword(auth, password, { label = '', context = 'login' } = {}) {
  if (!auth) {
    await verifyPassword('', password, null); // mesmo tempo de resposta
    return 'invalid';
  }
  if (auth.locked_at) {
    await verifyPassword('', password, null);
    return 'locked';
  }
  if (await verifyPassword(auth.id, password, auth.password_hash)) {
    if (auth.failed_attempts) await run('UPDATE auth_users SET failed_attempts = 0 WHERE id = ?', [auth.id]);
    // Hash antigo (importado): refaz no formato atual, já que temos a senha.
    if (isLegacyHash(auth.password_hash)) {
      await run('UPDATE auth_users SET password_hash = ? WHERE id = ?', [await hashPassword(auth.id, password), auth.id]);
    }
    return 'ok';
  }
  if (!auth.password_hash) return 'invalid';
  const row = await one(`UPDATE auth_users SET failed_attempts = failed_attempts + 1,
      locked_at = CASE WHEN failed_attempts + 1 >= ? THEN now() ELSE NULL END
    WHERE id = ? RETURNING failed_attempts, locked_at`, [config.maxLoginAttempts, auth.id]);
  if (row?.locked_at) {
    await destroyUserSessions(auth.id);
    await addAudit('Sistema', 'Bloqueio', 'Conta de acesso bloqueada',
      label || auth.id, `${config.maxLoginAttempts} tentativas inválidas seguidas (${context})`);
  }
  return 'invalid';
}

// Limite por endereço IP, contra tentativas em massa em várias contas.
const failures = new Map();
const WINDOW_MS = 15 * 60_000;
const MAX_IP_FAILURES = 30;

export function ipBlocked(ip) {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_IP_FAILURES;
}

export function registerIpFailure(ip) {
  const entry = failures.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(ip, { first: Date.now(), count: 1 });
  else entry.count += 1;
}

export async function purgeExpiredSessions() {
  await run('DELETE FROM sessions WHERE expires_at <= now()');
}
