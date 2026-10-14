import crypto from 'node:crypto';
import { db, nowIso } from './db.js';
import { config } from './config.js';

const COOKIE = 'sisferias_session';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 86400_000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(sha256(token), userId, nowIso(), expires.toISOString());
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // rede interna sem HTTPS; ative se publicar atrás de HTTPS
    expires,
    path: '/',
  });
}

export function destroySession(req, res) {
  const token = readCookie(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(COOKIE, { path: '/' });
}

export function destroyUserSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
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
export function loadSession(req, _res, next) {
  const token = readCookie(req);
  if (token) {
    const tokenHash = sha256(token);
    const row = db.prepare(`
      SELECT p.*, s.elevated_until AS _elevated_until FROM sessions s
      JOIN profiles p ON p.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`).get(tokenHash, nowIso());
    if (row) {
      const { _elevated_until: elevatedUntil, ...profile } = row;
      req.user = profile;
      req.session = { tokenHash, elevatedUntil };
    }
  }
  next();
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

// ---------------------------------------------------------------------------
// Área de Segurança: o administrador confirma a própria senha e ganha um
// período de acesso que se renova a cada ação e expira por inatividade.
// ---------------------------------------------------------------------------

export const isElevated = (req) =>
  !!req.session?.elevatedUntil && req.session.elevatedUntil > nowIso();

export function elevateSession(req) {
  const until = new Date(Date.now() + config.elevationMinutes * 60_000).toISOString();
  db.prepare('UPDATE sessions SET elevated_until = ? WHERE token_hash = ?').run(until, req.session.tokenHash);
  req.session.elevatedUntil = until;
  return until;
}

export function endElevation(req) {
  if (!req.session) return;
  db.prepare('UPDATE sessions SET elevated_until = NULL WHERE token_hash = ?').run(req.session.tokenHash);
  req.session.elevatedUntil = null;
}

/** Admin com a senha confirmada recentemente. Cada uso renova o prazo. */
export function requireElevated(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Apenas administradores podem executar esta ação.' });
  if (!isElevated(req)) {
    return res.status(403).json({
      error: 'Por segurança, confirme sua senha para continuar.',
      code: 'reauth_required',
    });
  }
  elevateSession(req);
  next();
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

// Limite de tentativas de login: 10 falhas em 15 minutos por IP + login.
const failures = new Map();
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 10;

export function loginBlocked(key) {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function registerLoginFailure(key) {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(key, { first: Date.now(), count: 1 });
  else entry.count += 1;
}

export const clearLoginFailures = (key) => failures.delete(key);

export function purgeExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso());
}
