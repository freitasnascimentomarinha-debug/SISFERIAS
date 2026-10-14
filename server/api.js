import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import {
  db, rowOut, rowsOut, upsertRow, updateRow, transaction, newId, nowIso, hashPassword, verifyPassword,
} from './db.js';
import {
  createSession, destroySession, destroyUserSessions, requireAuth, requireAdmin, requireElevated,
  isElevated, elevateSession, endElevation, loginBlocked, registerLoginFailure, clearLoginFailures,
} from './auth.js';
import { TABLES } from './schema.js';
import { previewImport, applyImport, exportAll, exportTableCsv, countAll } from './importer.js';
import { createBackup, listBackups, getBackupCopyDir, getBackupCopyStatus, setBackupCopyDir, copyToExtraFolder } from './backup.js';
import { config } from './config.js';
import { setDeadline, deadlineInForce } from './deadline.js';
import { autoCertFile } from './tls.js';

export const api = express.Router();

// Erros de validação viram resposta 400 com a mensagem.
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

// Express 5 já encaminha erros de handlers assíncronos; este wrapper mantém
// os handlers síncronos legíveis.
const h = (fn) => (req, res, next) => {
  try {
    const result = fn(req, res, next);
    if (result && typeof result.catch === 'function') result.catch(next);
  } catch (err) { next(err); }
};

// Imagens chegam como data URL (já reduzidas pela tela). Limite de 2 MB.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
function checkImage(value, label) {
  if (value === undefined || value === null || value === '') return;
  const text = String(value);
  if (!text.startsWith('data:')) return; // endereço de imagem (http...) não é validado aqui
  const match = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.exec(text);
  if (!match) fail(400, `${label}: formato de imagem não suportado (use JPG, PNG ou WEBP).`);
  const bytes = Math.floor((text.length - match[0].length) * 3 / 4);
  if (bytes > MAX_IMAGE_BYTES) fail(413, `${label}: imagem grande demais (máximo de 2 MB).`);
}

function checkPasswordRule(password) {
  if (password.length < config.minPasswordLength) {
    fail(400, `A senha deve ter pelo menos ${config.minPasswordLength} caracteres.`);
  }
}

const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj?.[k] !== undefined).map(k => [k, obj[k]]));
const isAdmin = (req) => req.user?.role === 'admin';

// ---------------------------------------------------------------------------
// Perfis
// ---------------------------------------------------------------------------

const PROFILE_SQL = `
  SELECT p.*,
    (SELECT e.sector FROM employees e
      WHERE e.user_id = p.id AND COALESCE(e.sector, '') <> ''
      ORDER BY e.planning_year DESC LIMIT 1) AS latest_sector,
    (a.password_hash IS NOT NULL) AS has_password
  FROM profiles p LEFT JOIN auth_users a ON a.id = p.id`;

function profileOut(row) {
  if (!row) return null;
  return {
    ...rowOut('profiles', row),
    latest_sector: row.latest_sector || null,
    has_password: !!row.has_password,
  };
}

const getProfile = (id) => profileOut(db.prepare(`${PROFILE_SQL} WHERE p.id = ?`).get(id));

/** Setor efetivo: o do lançamento mais recente, senão o do cadastro. */
const effectiveSector = (profile) => profile.latest_sector || profile.sector || '';

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

api.get('/health', (_req, res) => res.json({ ok: true }));

// Certificado público do servidor (com HTTPS ativo), para instalar nos
// computadores da rede e evitar o aviso de "conexão não segura".
api.get('/certificado', h((_req, res) => {
  if (!config.https.enabled) fail(404, 'O HTTPS não está ativado neste servidor.');
  const file = config.https.cert || autoCertFile();
  if (!fs.existsSync(file)) fail(404, 'Certificado não encontrado.');
  res.setHeader('Content-Type', 'application/x-x509-ca-cert');
  res.setHeader('Content-Disposition', 'attachment; filename="sisferias.crt"');
  res.send(fs.readFileSync(file));
}));

api.post('/auth/login', h((req, res) => {
  const login = String(req.body?.login || '').trim();
  const password = String(req.body?.password || '');
  if (!login || !password) fail(400, 'Informe NIP/e-mail e senha.');

  const key = `${req.ip}|${login.toLowerCase()}`;
  if (loginBlocked(key)) fail(429, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');

  let auth;
  if (login.includes('@')) {
    auth = db.prepare('SELECT * FROM auth_users WHERE email = ?').get(login);
  } else {
    auth = db.prepare(`SELECT a.* FROM profiles p JOIN auth_users a ON a.id = p.id
      WHERE p.nip = ? ORDER BY p.created_at LIMIT 1`).get(login);
  }

  if (auth && !auth.password_hash) {
    fail(401, 'Esta conta ainda não tem senha definida. Procure o administrador.');
  }
  if (!auth || !verifyPassword(password, auth.password_hash)) {
    registerLoginFailure(key);
    fail(401, 'NIP/e-mail ou senha incorretos.');
  }
  const profile = getProfile(auth.id);
  if (!profile) fail(401, 'Conta sem perfil cadastrado. Procure o administrador.');

  clearLoginFailures(key);
  createSession(res, auth.id);
  res.json({ user: profile });
}));

api.post('/auth/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

api.get('/auth/me', (req, res) => {
  res.json({ user: req.user ? getProfile(req.user.id) : null });
});

api.post('/auth/register', h((req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim();
  const password = String(b.password || '');
  const nip = String(b.nip || '').trim();
  if (!name || !email || !password) fail(400, 'Nome, e-mail e senha são obrigatórios.');
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) fail(400, 'E-mail inválido.');
  checkPasswordRule(password);
  if (db.prepare('SELECT 1 FROM auth_users WHERE email = ?').get(email)) {
    fail(409, 'Este e-mail já está cadastrado.');
  }
  if (nip && db.prepare('SELECT 1 FROM profiles WHERE nip = ?').get(nip)) {
    fail(409, 'Este NIP já está cadastrado.');
  }

  const id = newId();
  transaction(() => {
    db.prepare('INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(id, email, hashPassword(password), nowIso());
    upsertRow('profiles', {
      id, name, email, nip,
      role: 'user',
      // Depois do prazo final, contas novas já nascem bloqueadas.
      is_blocked: deadlineInForce(),
      war_name: String(b.war_name || ''),
      category: String(b.category || ''),
      sector: String(b.sector || ''),
      rank: String(b.rank || ''),
    });
    const specialization = String(b.specialization || '').trim().toUpperCase();
    if (specialization) upsertRow('print_preferences', { user_id: id, specialization });
  });
  res.status(201).json({ id });
}));

api.post('/auth/password', requireAuth, h((req, res) => {
  const password = String(req.body?.password || '');
  checkPasswordRule(password);
  // A senha atual só é dispensada logo após confirmá-la na área de Segurança.
  if (!isElevated(req)) {
    const auth = db.prepare('SELECT password_hash FROM auth_users WHERE id = ?').get(req.user.id);
    if (!verifyPassword(String(req.body?.current_password || ''), auth?.password_hash)) {
      fail(400, 'Senha atual incorreta.');
    }
  }
  db.prepare('UPDATE auth_users SET password_hash = ? WHERE id = ?').run(hashPassword(password), req.user.id);
  res.json({ ok: true });
}));

// Área de Segurança: o admin confirma a própria senha de login.
api.get('/auth/elevation', requireAuth, (req, res) => {
  res.json({ elevated: isAdmin(req) && isElevated(req), until: req.session.elevatedUntil, minutes: config.elevationMinutes });
});

api.post('/auth/elevate', requireAdmin, h((req, res) => {
  const key = `elevate|${req.ip}|${req.user.id}`;
  if (loginBlocked(key)) fail(429, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
  const auth = db.prepare('SELECT password_hash FROM auth_users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(String(req.body?.password || ''), auth?.password_hash)) {
    registerLoginFailure(key);
    upsertRow('audit_logs', {
      id: newId(), timestamp: nowIso(), user_name: req.user.name, action: 'Bloqueio',
      field: 'Acesso à área de Segurança', old_value: '-', new_value: 'Senha incorreta',
    });
    fail(401, 'Senha incorreta.');
  }
  clearLoginFailures(key);
  const until = elevateSession(req);
  upsertRow('audit_logs', {
    id: newId(), timestamp: nowIso(), user_name: req.user.name, action: 'Alteração',
    field: 'Acesso à área de Segurança', old_value: '-', new_value: 'Liberado',
  });
  res.json({ elevated: true, until, minutes: config.elevationMinutes });
}));

api.post('/auth/elevate/end', requireAuth, (req, res) => {
  endElevation(req);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Usuários (perfis)
// ---------------------------------------------------------------------------

api.get('/profiles', requireAuth, (req, res) => {
  res.json(db.prepare(`${PROFILE_SQL} ORDER BY p.name`).all().map(profileOut));
});

api.get('/profiles/:id', requireAuth, h((req, res) => {
  const profile = getProfile(req.params.id);
  if (!profile) fail(404, 'Usuário não encontrado.');
  res.json(profile);
}));

api.patch('/profiles/:id', requireElevated, h((req, res) => {
  const target = getProfile(req.params.id);
  if (!target) fail(404, 'Usuário não encontrado.');
  const changes = pick(req.body, ['is_blocked', 'role', 'view_all_sectors']);
  if (changes.role !== undefined && !['admin', 'user'].includes(changes.role)) fail(400, 'Papel inválido.');
  if (changes.role === 'user' && target.role === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) c FROM profiles WHERE role = 'admin'").get().c;
    if (admins <= 1) fail(400, 'Não é possível remover o último administrador.');
  }
  updateRow('profiles', { id: target.id }, changes);
  res.json(getProfile(target.id));
}));

// Bloqueio/liberação geral de lançamentos (prazo final).
api.post('/profiles/block-all', requireElevated, h((req, res) => {
  const status = !!req.body?.status;
  db.prepare('UPDATE profiles SET is_blocked = ?, updated_at = ?').run(status ? 1 : 0, nowIso());
  res.json({ ok: true });
}));

api.post('/admin/reset-password', requireElevated, h((req, res) => {
  const email = String(req.body?.email || '').trim();
  const userId = String(req.body?.userId || '').trim();
  const password = String(req.body?.password || '');
  checkPasswordRule(password);
  const profile = userId
    ? db.prepare('SELECT id, email FROM profiles WHERE id = ?').get(userId)
    : db.prepare('SELECT id, email FROM profiles WHERE email = ?').get(email);
  if (!profile) fail(404, 'Usuário não encontrado.');

  transaction(() => {
    const hash = hashPassword(password);
    const auth = db.prepare('SELECT id FROM auth_users WHERE id = ?').get(profile.id);
    if (auth) {
      db.prepare('UPDATE auth_users SET password_hash = ? WHERE id = ?').run(hash, profile.id);
    } else {
      if (db.prepare('SELECT 1 FROM auth_users WHERE email = ?').get(profile.email)) {
        fail(409, 'O e-mail deste perfil já pertence a outra conta.');
      }
      db.prepare('INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
        .run(profile.id, profile.email, hash, nowIso());
    }
  });
  // Encerra as sessões do usuário (exceto se for o próprio admin).
  if (profile.id !== req.user.id) destroyUserSessions(profile.id);
  res.json({ ok: true });
}));

api.delete('/profiles/:id', requireElevated, h((req, res) => {
  const target = getProfile(req.params.id);
  if (!target) fail(404, 'Usuário não encontrado.');
  if (target.id === req.user.id) fail(400, 'Você não pode excluir a própria conta.');
  createBackup('antes-exclusao-usuario');
  transaction(() => {
    db.prepare('DELETE FROM employees WHERE user_id = ?').run(target.id);
    db.prepare('DELETE FROM print_preferences WHERE user_id = ?').run(target.id);
    db.prepare('DELETE FROM profiles WHERE id = ?').run(target.id);
    db.prepare('DELETE FROM auth_users WHERE id = ?').run(target.id); // sessões caem junto
  });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Lançamentos de férias
// ---------------------------------------------------------------------------

const EMPLOYEE_FIELDS = Object.keys(TABLES.employees.columns)
  .filter(c => !['id', 'created_at', 'updated_at'].includes(c));

api.get('/employees', requireAuth, (req, res) => {
  const me = getProfile(req.user.id);
  let rows;
  if (me.role === 'admin' && !me.view_all_sectors) {
    // Admin restrito ao próprio setor; sem setor definido, não vê nada.
    const sector = effectiveSector(me);
    rows = sector ? db.prepare('SELECT * FROM employees WHERE sector = ?').all(sector) : [];
  } else {
    rows = db.prepare('SELECT * FROM employees').all();
  }
  res.json(rowsOut('employees', rows));
});

function assertCanEdit(req, userId) {
  if (isAdmin(req)) return;
  if (userId !== req.user.id) fail(403, 'Você só pode alterar os seus próprios lançamentos.');
  if (req.user.is_blocked) fail(403, 'Os lançamentos estão bloqueados. Procure o administrador.');
}

api.post('/employees', requireAuth, h((req, res) => {
  const body = req.body || {};
  const data = pick(body, EMPLOYEE_FIELDS);
  if (!data.user_id) fail(400, 'Lançamento sem usuário.');
  checkImage(data.photo_url, 'Foto');
  if (!Number.isInteger(Number(data.planning_year))) fail(400, 'Ano de referência inválido.');
  if (data.vacation_parcels !== undefined && !Array.isArray(
    typeof data.vacation_parcels === 'string' ? JSON.parse(data.vacation_parcels) : data.vacation_parcels,
  )) fail(400, 'Parcelas inválidas.');
  assertCanEdit(req, data.user_id);

  let id = body.id;
  transaction(() => {
    if (id) {
      const existing = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(id);
      if (!existing) fail(404, 'Lançamento não encontrado.');
      assertCanEdit(req, existing.user_id);
      const clash = db.prepare('SELECT id FROM employees WHERE user_id = ? AND planning_year = ? AND id <> ?')
        .get(data.user_id, Number(data.planning_year), id);
      if (clash) fail(409, `Já existe um lançamento deste militar para o ano ${data.planning_year}.`);
      updateRow('employees', { id }, data);
    } else {
      // Um lançamento por militar por ano: reaproveita o existente.
      const existing = db.prepare('SELECT id FROM employees WHERE user_id = ? AND planning_year = ?')
        .get(data.user_id, Number(data.planning_year));
      id = existing?.id || newId();
      upsertRow('employees', { ...data, id });
    }
  });
  res.json(rowOut('employees', db.prepare('SELECT * FROM employees WHERE id = ?').get(id)));
}));

api.patch('/employees/:id', requireAuth, h((req, res) => {
  const existing = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) fail(404, 'Lançamento não encontrado.');
  assertCanEdit(req, existing.user_id);
  const data = pick(req.body, EMPLOYEE_FIELDS.filter(f => f !== 'user_id'));
  checkImage(data.photo_url, 'Foto');
  updateRow('employees', { id: req.params.id }, data);
  res.json(rowOut('employees', db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id)));
}));

api.delete('/employees/:id', requireAuth, h((req, res) => {
  const existing = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(req.params.id);
  if (!existing) return res.json({ ok: true });
  assertCanEdit(req, existing.user_id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Configurações, avisos, auditoria, sugestões
// ---------------------------------------------------------------------------

api.get('/settings', requireAuth, (_req, res) => {
  res.json(rowOut('system_settings', db.prepare('SELECT * FROM system_settings WHERE id = 1').get()));
});

api.put('/settings', requireElevated, h((req, res) => {
  const data = pick(req.body, ['institution_name', 'total_manpower', 'logo_url', 'staff_json']);
  checkImage(data.logo_url, 'Logo');
  upsertRow('system_settings', { ...data, id: 1 });
  res.json(rowOut('system_settings', db.prepare('SELECT * FROM system_settings WHERE id = 1').get()));
}));

// Prazo final de lançamento (vale para todos os administradores).
api.put('/settings/deadline', requireElevated, h((req, res) => {
  const deadline = req.body?.deadline ? String(req.body.deadline) : null;
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) fail(400, 'Data inválida.');
  const result = setDeadline(deadline, req.user.name);
  res.json({ ...result, settings: rowOut('system_settings', db.prepare('SELECT * FROM system_settings WHERE id = 1').get()) });
}));

api.get('/notices', requireAuth, (_req, res) => {
  res.json(rowsOut('notices', db.prepare('SELECT * FROM notices ORDER BY created_at').all()));
});

api.post('/notices', requireElevated, h((req, res) => {
  const title = String(req.body?.title || '').trim();
  const content = String(req.body?.content || '').trim();
  if (!title) fail(400, 'Informe o título do aviso.');
  const id = newId();
  upsertRow('notices', { id, title, content, is_pinned: !!req.body?.is_pinned, created_at: nowIso() });
  res.status(201).json(rowOut('notices', db.prepare('SELECT * FROM notices WHERE id = ?').get(id)));
}));

api.patch('/notices/:id', requireElevated, h((req, res) => {
  updateRow('notices', { id: req.params.id }, pick(req.body, ['title', 'content', 'is_pinned']));
  res.json({ ok: true });
}));

api.delete('/notices/:id', requireElevated, (req, res) => {
  db.prepare('DELETE FROM notices WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

api.get('/audit-logs', requireAdmin, (_req, res) => {
  res.json(rowsOut('audit_logs', db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC').all()));
});

api.post('/audit-logs', requireAuth, h((req, res) => {
  const id = newId();
  upsertRow('audit_logs', {
    id,
    timestamp: nowIso(),
    ...pick(req.body, ['action', 'field', 'old_value', 'new_value']),
    // Sempre o nome de quem está logado: a tela não pode escolher o autor.
    user_name: req.user.name,
  });
  res.status(201).json(rowOut('audit_logs', db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id)));
}));

api.get('/suggestions', requireAuth, (req, res) => {
  const rows = isAdmin(req)
    ? db.prepare('SELECT * FROM suggestions ORDER BY created_at DESC').all()
    : db.prepare('SELECT * FROM suggestions WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rowsOut('suggestions', rows));
});

api.post('/suggestions', requireAuth, h((req, res) => {
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  if (!title || !description) fail(400, 'Informe título e descrição.');
  const id = newId();
  upsertRow('suggestions', {
    id,
    user_id: req.user.id,
    user_name: String(req.body?.user_name || req.user.name || ''),
    war_name: String(req.body?.war_name || req.user.war_name || ''),
    title,
    description,
    created_at: nowIso(),
  });
  res.status(201).json(rowOut('suggestions', db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id)));
}));

api.delete('/suggestions/:id', requireElevated, (req, res) => {
  db.prepare('DELETE FROM suggestions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Preferências de impressão
// ---------------------------------------------------------------------------

const PRINT_FIELDS = Object.keys(TABLES.print_preferences.columns)
  .filter(c => !['user_id', 'created_at', 'updated_at'].includes(c));

function assertOwnerOrAdmin(req, userId) {
  if (!isAdmin(req) && userId !== req.user.id) fail(403, 'Acesso negado.');
}

api.get('/print-preferences/:userId', requireAuth, h((req, res) => {
  assertOwnerOrAdmin(req, req.params.userId);
  res.json(rowOut('print_preferences', db.prepare('SELECT * FROM print_preferences WHERE user_id = ?').get(req.params.userId)));
}));

api.put('/print-preferences/:userId', requireAuth, h((req, res) => {
  assertOwnerOrAdmin(req, req.params.userId);
  upsertRow('print_preferences', { ...pick(req.body, PRINT_FIELDS), user_id: req.params.userId });
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Administração de dados: importação, exportação e backups
// ---------------------------------------------------------------------------

api.get('/admin/stats', requireElevated, (_req, res) => {
  res.json({
    counts: countAll(),
    dbFile: config.dbFile,
    backups: listBackups().slice(0, 10),
    backupCopyDir: getBackupCopyDir(),
    backupCopyStatus: getBackupCopyStatus(),
  });
});

api.post('/admin/import/preview', requireElevated, h((req, res) => {
  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  if (!files.length) fail(400, 'Selecione ao menos um arquivo.');
  res.json(previewImport(files, req.body?.overrides || {}));
}));

api.post('/admin/import/apply', requireElevated, h((req, res) => {
  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  if (!files.length) fail(400, 'Selecione ao menos um arquivo.');
  const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
  try {
    const result = applyImport(files, req.body?.overrides || {}, { mode });
    upsertRow('audit_logs', {
      id: newId(), timestamp: nowIso(), user_name: req.user.name, action: 'Alteração',
      field: 'Importação de dados', old_value: mode, new_value: files.map(f => f.name).join(', '),
    });
    res.json({ ...result, backupFile: path.basename(result.backupFile) });
  } catch (err) {
    if (err.report) return res.status(400).json({ error: err.message, report: err.report });
    throw err;
  }
}));

api.get('/admin/export', requireElevated, (req, res) => {
  const includePasswords = req.query.passwords !== '0';
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="sisferias_backup_${stamp}.json"`);
  res.json(exportAll({ includePasswords }));
});

api.get('/admin/export/:table', requireElevated, h((req, res) => {
  const table = req.params.table.replace(/\.csv$/, '');
  if (!(table in TABLES)) fail(404, 'Tabela desconhecida.');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${table}.csv"`);
  res.send(exportTableCsv(table));
}));

// Pasta extra para onde cada backup também é copiado (rede, outro disco).
api.put('/admin/backup-copy', requireElevated, h(async (req, res) => {
  const dir = String(req.body?.dir || '').trim() || null;
  let saved;
  try {
    saved = await setBackupCopyDir(dir);
  } catch (err) {
    fail(400, `Não foi possível gravar na pasta: ${err.message}`);
  }
  upsertRow('audit_logs', {
    id: newId(), timestamp: nowIso(), user_name: req.user.name, action: 'Alteração',
    field: 'Pasta de cópia dos backups', old_value: '-', new_value: saved || 'Removida',
  });
  // Faz uma cópia imediata para confirmar que está funcionando.
  if (saved) await copyToExtraFolder(createBackup('manual', { copy: false }));
  res.json({ backupCopyDir: saved, backupCopyStatus: getBackupCopyStatus() });
}));

api.get('/admin/backups', requireElevated, (_req, res) => res.json(listBackups()));

api.post('/admin/backups', requireElevated, (_req, res) => {
  const file = createBackup('manual');
  res.status(201).json({ file: path.basename(file) });
});

api.get('/admin/backups/:file', requireElevated, h((req, res) => {
  const name = path.basename(req.params.file);
  const full = path.join(config.backupDir, name);
  if (!name.endsWith('.db') || !fs.existsSync(full)) fail(404, 'Backup não encontrado.');
  res.download(full, name);
}));

// ---------------------------------------------------------------------------

api.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// eslint-disable-next-line no-unused-vars
api.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Arquivo grande demais.' });
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Dados inválidos.' });
  console.error('[api]', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});
