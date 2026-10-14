import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import {
  q, one, run, rowOut, rowsOut, upsertRow, updateRow, transaction, newId, nowIso, addAudit,
  findAuthByLogin, setAuthPassword, dbInfo,
} from './db.js';
import {
  createSession, destroySession, destroyUserSessions, requireAuth, requireAdmin, requireElevated,
  isElevated, elevateSession, endElevation, checkAccountPassword, ipBlocked, registerIpFailure,
} from './auth.js';
import { blindIndex, decrypt, passwordProblems, PASSWORD_RULE_TEXT } from './crypto.js';
import { TABLES } from './schema.js';
import { previewImport, applyImport, exportAll, exportTableCsv, countAll } from './importer.js';
import { createBackup, listBackups, getBackupCopyDir, getBackupCopyStatus, setBackupCopyDir, copyToExtraFolder } from './backup.js';
import { config } from './config.js';
import { setDeadline, deadlineInForce } from './deadline.js';
import { autoCertFile } from './tls.js';

export const api = express.Router();

// Erros de validação viram resposta 4xx com a mensagem.
class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

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

/** Regra de senha da DCTIMBOTEC 31/002/2020, item 3.2.b. */
function checkPasswordRule(password) {
  const missing = passwordProblems(password);
  if (missing.length) fail(400, `A senha deve ter ${PASSWORD_RULE_TEXT}. Falta: ${missing.join(', ')}.`, { code: 'password_rule' });
}

// Mensagem única para qualquer falha de login (item 3.2.f): não revela se o
// usuário existe, se a senha está errada ou se a conta está bloqueada.
const LOGIN_FAILED = `Usuário e/ou senha inválidos. Após ${config.maxLoginAttempts} tentativas inválidas seguidas, a conta é bloqueada e somente um administrador pode liberá-la.`;

const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj?.[k] !== undefined).map(k => [k, obj[k]]));
const isAdmin = (req) => req.user?.role === 'admin';
const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');

// ---------------------------------------------------------------------------
// Perfis
// ---------------------------------------------------------------------------

const PROFILE_SQL = `
  SELECT p.*,
    (SELECT e.sector FROM employees e
      WHERE e.user_id = p.id AND COALESCE(e.sector, '') <> ''
      ORDER BY e.planning_year DESC LIMIT 1) AS latest_sector,
    (a.password_hash IS NOT NULL) AS has_password,
    (a.locked_at IS NOT NULL) AS account_locked,
    COALESCE(a.must_change_password, FALSE) AS must_change_password
  FROM profiles p LEFT JOIN auth_users a ON a.id = p.id`;

function profileOut(row) {
  if (!row) return null;
  return {
    ...rowOut('profiles', row),
    latest_sector: row.latest_sector || null,
    has_password: !!row.has_password,
    account_locked: !!row.account_locked,
    must_change_password: !!row.must_change_password,
  };
}

const getProfile = async (id) => profileOut(await one(`${PROFILE_SQL} WHERE p.id = ?`, [id]));

/** Setor efetivo: o do lançamento mais recente, senão o do cadastro. */
const effectiveSector = (profile) => profile.latest_sector || profile.sector || '';

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

api.get('/health', (_req, res) => res.json({ ok: true }));

// Informações públicas para a tela de login (ambiente e regra de senha).
api.get('/ambiente', (_req, res) => {
  res.json({
    environment: config.environment,
    passwordRule: PASSWORD_RULE_TEXT,
    minPasswordLength: config.minPasswordLength,
    maxLoginAttempts: config.maxLoginAttempts,
  });
});

// Certificado público do servidor (com HTTPS ativo), para instalar nos
// computadores da rede e evitar o aviso de "conexão não segura".
api.get('/certificado', (_req, res) => {
  if (!config.https.enabled) fail(404, 'O HTTPS não está ativado neste servidor.');
  if (config.https.pfx) fail(404, 'Este servidor usa certificado da instituição (arquivo .pfx).');
  const file = config.https.cert || autoCertFile();
  if (!fs.existsSync(file)) fail(404, 'Certificado não encontrado.');
  res.setHeader('Content-Type', 'application/x-x509-ca-cert');
  res.setHeader('Content-Disposition', 'attachment; filename="sisferias.crt"');
  res.send(fs.readFileSync(file));
});

api.get('/auth/login', (_req, res) => {
  // Autenticação somente por POST (item 3.1.f).
  res.status(405).set('Allow', 'POST').json({ error: 'Método não permitido.' });
});

api.post('/auth/login', async (req, res) => {
  const login = String(req.body?.login || '').trim();
  const password = String(req.body?.password || '');
  // Só depois de preenchidos todos os dados (item 3.2.f).
  if (!login || !password) fail(400, 'Informe o usuário (NIP ou e-mail) e a senha.');
  if (ipBlocked(req.ip)) fail(429, 'Muitas tentativas a partir deste computador. Aguarde 15 minutos e tente novamente.');

  const auth = await findAuthByLogin(login);
  const result = await checkAccountPassword(auth, password, { label: login, context: 'login' });
  const profile = result === 'ok' ? await getProfile(auth.id) : null;
  if (!profile) {
    registerIpFailure(req.ip);
    res.locals.opDetail = `Falha de login (${login})`;
    fail(401, LOGIN_FAILED);
  }

  // Senha antiga fora da regra atual: troca obrigatória agora.
  if (passwordProblems(password).length && !profile.must_change_password) {
    await run('UPDATE auth_users SET must_change_password = TRUE WHERE id = ?', [auth.id]);
    profile.must_change_password = true;
  }
  await createSession(res, auth.id);
  res.locals.opUser = { id: profile.id, label: profile.name };
  res.json({ user: profile });
});

api.post('/auth/logout', async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
});

api.get('/auth/me', async (req, res) => {
  res.json({ user: req.user ? await getProfile(req.user.id) : null });
});

api.post('/auth/register', async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim();
  const password = String(b.password || '');
  const nip = String(b.nip || '').trim();
  if (!name || !email || !password) fail(400, 'Nome, e-mail e senha são obrigatórios.');
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) fail(400, 'E-mail inválido.');
  checkPasswordRule(password);
  if (await one('SELECT 1 FROM auth_users WHERE email_hash = ?', [blindIndex(email)])) {
    fail(409, 'Este e-mail já está cadastrado.');
  }
  if (nip && await one('SELECT 1 FROM profiles WHERE nip_hash = ?', [blindIndex(nip)])) {
    fail(409, 'Este NIP já está cadastrado.');
  }

  const id = newId();
  const blocked = await deadlineInForce();
  await transaction(async () => {
    await setAuthPassword(id, email, password);
    await upsertRow('profiles', {
      id, name, email, nip,
      role: 'user',
      // Depois do prazo final, contas novas já nascem bloqueadas.
      is_blocked: blocked,
      war_name: String(b.war_name || ''),
      category: String(b.category || ''),
      sector: String(b.sector || ''),
      rank: String(b.rank || ''),
    });
    const specialization = String(b.specialization || '').trim().toUpperCase();
    if (specialization) await upsertRow('print_preferences', { user_id: id, specialization });
  });
  res.locals.opUser = { id, label: name };
  res.status(201).json({ id });
});

api.post('/auth/password', requireAuth, async (req, res) => {
  const password = String(req.body?.password || '');
  const current = String(req.body?.current_password || '');
  checkPasswordRule(password);
  const auth = await one('SELECT * FROM auth_users WHERE id = ?', [req.user.id]);
  // A senha atual só é dispensada logo após confirmá-la na área de Segurança.
  if (!isElevated(req) || current) {
    const result = await checkAccountPassword(auth, current, { label: req.user.name, context: 'troca de senha' });
    if (result !== 'ok') fail(400, 'Senha atual incorreta.');
    if (current === password) fail(400, 'A nova senha deve ser diferente da atual.');
  }
  await setAuthPassword(req.user.id, decrypt(auth.email), password);
  // As demais sessões abertas com a senha antiga são encerradas.
  await destroyUserSessions(req.user.id, { exceptTokenHash: req.session.tokenHash });
  res.json({ ok: true, user: await getProfile(req.user.id) });
});

// Área de Segurança: o admin confirma a própria senha de login.
api.get('/auth/elevation', requireAuth, (req, res) => {
  res.json({ elevated: isAdmin(req) && isElevated(req), until: req.session.elevatedUntil, minutes: config.elevationMinutes });
});

api.post('/auth/elevate', requireAdmin, async (req, res) => {
  const auth = await one('SELECT * FROM auth_users WHERE id = ?', [req.user.id]);
  const result = await checkAccountPassword(auth, String(req.body?.password || ''), { label: req.user.name, context: 'área de Segurança' });
  if (result !== 'ok') {
    await addAudit(req.user.name, 'Bloqueio', 'Acesso à área de Segurança', '-', 'Senha incorreta');
    fail(401, `Senha incorreta. Após ${config.maxLoginAttempts} tentativas inválidas seguidas, a conta é bloqueada.`);
  }
  const until = await elevateSession(req);
  await addAudit(req.user.name, 'Alteração', 'Acesso à área de Segurança', '-', 'Liberado');
  res.json({ elevated: true, until, minutes: config.elevationMinutes });
});

api.post('/auth/elevate/end', requireAuth, async (req, res) => {
  await endElevation(req);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Usuários (perfis)
// ---------------------------------------------------------------------------

// Usuário comum recebe completos apenas os próprios dados. Dos demais, só o
// necessário para os indicadores gerais da tela inicial, sem dados pessoais
// (LGPD, art. 6º, III — necessidade).
const minimalProfile = (p) => ({ id: p.id, category: p.category, role: p.role });

api.get('/profiles', requireAuth, async (req, res) => {
  const profiles = (await q(PROFILE_SQL)).map(profileOut).sort(byName);
  res.json(isAdmin(req) ? profiles : profiles.map(p => (p.id === req.user.id ? p : minimalProfile(p))));
});

api.get('/profiles/:id', requireAuth, async (req, res) => {
  if (!isAdmin(req) && req.params.id !== req.user.id) fail(403, 'Você só pode consultar o seu próprio cadastro.');
  const profile = await getProfile(req.params.id);
  if (!profile) fail(404, 'Usuário não encontrado.');
  res.json(profile);
});

api.patch('/profiles/:id', requireElevated, async (req, res) => {
  const target = await getProfile(req.params.id);
  if (!target) fail(404, 'Usuário não encontrado.');
  const changes = pick(req.body, ['is_blocked', 'role', 'view_all_sectors']);
  if (changes.role !== undefined && !['admin', 'user'].includes(changes.role)) fail(400, 'Papel inválido.');
  if (changes.role === 'user' && target.role === 'admin') {
    const admins = (await one("SELECT COUNT(*)::int c FROM profiles WHERE role = 'admin'")).c;
    if (admins <= 1) fail(400, 'Não é possível remover o último administrador.');
  }
  await updateRow('profiles', { id: target.id }, changes);
  // Libera a conta bloqueada por tentativas inválidas de senha.
  if (req.body?.unlock && target.account_locked) {
    await run('UPDATE auth_users SET locked_at = NULL, failed_attempts = 0 WHERE id = ?', [target.id]);
    await addAudit(req.user.name, 'Desbloqueio', 'Conta de acesso liberada', target.name, 'Liberada pelo administrador');
  }
  res.json(await getProfile(target.id));
});

// Bloqueio/liberação geral de lançamentos (prazo final).
api.post('/profiles/block-all', requireElevated, async (req, res) => {
  await run('UPDATE profiles SET is_blocked = ?, updated_at = now()', [!!req.body?.status]);
  res.json({ ok: true });
});

api.post('/admin/reset-password', requireElevated, async (req, res) => {
  const email = String(req.body?.email || '').trim();
  const userId = String(req.body?.userId || '').trim();
  const password = String(req.body?.password || '');
  checkPasswordRule(password);
  const row = userId
    ? await one('SELECT id, email, name FROM profiles WHERE id = ?', [userId])
    : await one('SELECT id, email, name FROM profiles WHERE email_hash = ?', [blindIndex(email)]);
  if (!row) fail(404, 'Usuário não encontrado.');
  const profile = { id: row.id, email: decrypt(row.email), name: decrypt(row.name) };
  const self = profile.id === req.user.id;

  await transaction(async () => {
    const auth = await one('SELECT id FROM auth_users WHERE id = ?', [profile.id]);
    if (!auth && await one('SELECT 1 FROM auth_users WHERE email_hash = ?', [blindIndex(profile.email)])) {
      fail(409, 'O e-mail deste perfil já pertence a outra conta.');
    }
    // Senha definida pelo administrador é provisória: troca obrigatória no 1º acesso (item 3.2.d).
    await setAuthPassword(profile.id, profile.email, password, { mustChange: !self });
  });
  // Encerra as sessões do usuário (exceto se for o próprio admin).
  if (!self) await destroyUserSessions(profile.id);
  res.json({ ok: true, mustChange: !self });
});

api.delete('/profiles/:id', requireElevated, async (req, res) => {
  const target = await getProfile(req.params.id);
  if (!target) fail(404, 'Usuário não encontrado.');
  if (target.id === req.user.id) fail(400, 'Você não pode excluir a própria conta.');
  await createBackup('antes-exclusao-usuario');
  await transaction(async () => {
    await run('DELETE FROM employees WHERE user_id = ?', [target.id]);
    await run('DELETE FROM print_preferences WHERE user_id = ?', [target.id]);
    await run('DELETE FROM profiles WHERE id = ?', [target.id]);
    await run('DELETE FROM auth_users WHERE id = ?', [target.id]); // sessões caem junto
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Lançamentos de férias
// ---------------------------------------------------------------------------

const EMPLOYEE_FIELDS = Object.keys(TABLES.employees.columns)
  .filter(c => !['id', 'created_at', 'updated_at'].includes(c));

const getEmployee = async (id) => rowOut('employees', await one('SELECT * FROM employees WHERE id = ?', [id]));

api.get('/employees', requireAuth, async (req, res) => {
  const me = await getProfile(req.user.id);
  let rows;
  if (me.role === 'admin' && !me.view_all_sectors) {
    // Admin restrito ao próprio setor; sem setor definido, não vê nada.
    const sector = effectiveSector(me);
    rows = sector ? await q('SELECT * FROM employees WHERE sector = ? ORDER BY created_at, id', [sector]) : [];
  } else {
    // Ordem fixa (de criação): as telas usam o primeiro lançamento de cada militar.
    rows = await q('SELECT * FROM employees ORDER BY created_at, id');
  }
  const out = rowsOut('employees', rows);
  res.json(me.role === 'admin' ? out : out.map(e => (e.user_id === req.user.id ? e : minimalEmployee(e))));
});

// Lançamentos de outros militares, para usuário comum: só datas e categoria,
// usadas nos indicadores da tela inicial (ausência hoje, efetivo por categoria)
// e o setor (lista de setores do formulário). Sem nome, NIP, foto,
// justificativa ou NUP.
function minimalEmployee(e) {
  let parcels = e.vacation_parcels;
  if (typeof parcels === 'string') { try { parcels = JSON.parse(parcels); } catch { parcels = []; } }
  return {
    id: e.id, user_id: e.user_id, sector: e.sector, category: e.category,
    planning_year: e.planning_year, total_vacation_days: e.total_vacation_days,
    vacation_parcels: (Array.isArray(parcels) ? parcels : [])
      .map(({ id, startDate, endDate, days }) => ({ id, startDate, endDate, days })),
  };
}

function assertCanEdit(req, userId) {
  if (isAdmin(req)) return;
  if (userId !== req.user.id) fail(403, 'Você só pode alterar os seus próprios lançamentos.');
  if (req.user.is_blocked) fail(403, 'Os lançamentos estão bloqueados. Procure o administrador.');
}

const parseParcels = (value) => (typeof value === 'string' ? JSON.parse(value) : value);

api.post('/employees', requireAuth, async (req, res) => {
  const body = req.body || {};
  const data = pick(body, EMPLOYEE_FIELDS);
  if (!data.user_id) fail(400, 'Lançamento sem usuário.');
  checkImage(data.photo_url, 'Foto');
  if (!Number.isInteger(Number(data.planning_year))) fail(400, 'Ano de referência inválido.');
  if (data.vacation_parcels !== undefined && !Array.isArray(parseParcels(data.vacation_parcels))) fail(400, 'Parcelas inválidas.');
  assertCanEdit(req, data.user_id);

  let id = body.id;
  await transaction(async () => {
    if (id) {
      const existing = await one('SELECT user_id FROM employees WHERE id = ?', [id]);
      if (!existing) fail(404, 'Lançamento não encontrado.');
      assertCanEdit(req, existing.user_id);
      const clash = await one('SELECT id FROM employees WHERE user_id = ? AND planning_year = ? AND id <> ?',
        [data.user_id, Number(data.planning_year), id]);
      if (clash) fail(409, `Já existe um lançamento deste militar para o ano ${data.planning_year}.`);
      await updateRow('employees', { id }, data);
    } else {
      // Um lançamento por militar por ano: reaproveita o existente.
      const existing = await one('SELECT id FROM employees WHERE user_id = ? AND planning_year = ?',
        [data.user_id, Number(data.planning_year)]);
      id = existing?.id || newId();
      await upsertRow('employees', { ...data, id });
    }
  });
  res.json(await getEmployee(id));
});

api.patch('/employees/:id', requireAuth, async (req, res) => {
  const existing = await one('SELECT user_id FROM employees WHERE id = ?', [req.params.id]);
  if (!existing) fail(404, 'Lançamento não encontrado.');
  assertCanEdit(req, existing.user_id);
  const data = pick(req.body, EMPLOYEE_FIELDS.filter(f => f !== 'user_id'));
  checkImage(data.photo_url, 'Foto');
  await updateRow('employees', { id: req.params.id }, data);
  res.json(await getEmployee(req.params.id));
});

api.delete('/employees/:id', requireAuth, async (req, res) => {
  const existing = await one('SELECT user_id FROM employees WHERE id = ?', [req.params.id]);
  if (!existing) return res.json({ ok: true });
  assertCanEdit(req, existing.user_id);
  await run('DELETE FROM employees WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Configurações, avisos, auditoria, sugestões
// ---------------------------------------------------------------------------

const getSettings = async () => rowOut('system_settings', await one('SELECT * FROM system_settings WHERE id = 1'));

api.get('/settings', requireAuth, async (_req, res) => {
  res.json(await getSettings());
});

api.put('/settings', requireElevated, async (req, res) => {
  const data = pick(req.body, ['institution_name', 'total_manpower', 'logo_url', 'staff_json']);
  checkImage(data.logo_url, 'Logo');
  await upsertRow('system_settings', { ...data, id: 1 });
  res.json(await getSettings());
});

// Prazo final de lançamento (vale para todos os administradores).
api.put('/settings/deadline', requireElevated, async (req, res) => {
  const deadline = req.body?.deadline ? String(req.body.deadline) : null;
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) fail(400, 'Data inválida.');
  const result = await setDeadline(deadline, req.user.name);
  res.json({ ...result, settings: await getSettings() });
});

api.get('/notices', requireAuth, async (_req, res) => {
  res.json(rowsOut('notices', await q('SELECT * FROM notices ORDER BY created_at')));
});

api.post('/notices', requireElevated, async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const content = String(req.body?.content || '').trim();
  if (!title) fail(400, 'Informe o título do aviso.');
  const id = newId();
  await upsertRow('notices', { id, title, content, is_pinned: !!req.body?.is_pinned, created_at: nowIso() });
  res.status(201).json(rowOut('notices', await one('SELECT * FROM notices WHERE id = ?', [id])));
});

api.patch('/notices/:id', requireElevated, async (req, res) => {
  await updateRow('notices', { id: req.params.id }, pick(req.body, ['title', 'content', 'is_pinned']));
  res.json({ ok: true });
});

api.delete('/notices/:id', requireElevated, async (req, res) => {
  await run('DELETE FROM notices WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

api.get('/audit-logs', requireAdmin, async (_req, res) => {
  res.json(rowsOut('audit_logs', await q('SELECT * FROM audit_logs ORDER BY timestamp DESC')));
});

api.post('/audit-logs', requireAuth, async (req, res) => {
  const id = newId();
  await upsertRow('audit_logs', {
    id,
    timestamp: nowIso(),
    ...pick(req.body, ['action', 'field', 'old_value', 'new_value']),
    // Sempre o nome de quem está logado: a tela não pode escolher o autor.
    user_name: req.user.name,
  });
  res.status(201).json(rowOut('audit_logs', await one('SELECT * FROM audit_logs WHERE id = ?', [id])));
});

api.get('/suggestions', requireAuth, async (req, res) => {
  const rows = isAdmin(req)
    ? await q('SELECT * FROM suggestions ORDER BY created_at DESC')
    : await q('SELECT * FROM suggestions WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(rowsOut('suggestions', rows));
});

api.post('/suggestions', requireAuth, async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  if (!title || !description) fail(400, 'Informe título e descrição.');
  const id = newId();
  await upsertRow('suggestions', {
    id,
    user_id: req.user.id,
    user_name: String(req.body?.user_name || req.user.name || ''),
    war_name: String(req.body?.war_name || req.user.war_name || ''),
    title,
    description,
    created_at: nowIso(),
  });
  res.status(201).json(rowOut('suggestions', await one('SELECT * FROM suggestions WHERE id = ?', [id])));
});

api.delete('/suggestions/:id', requireElevated, async (req, res) => {
  await run('DELETE FROM suggestions WHERE id = ?', [req.params.id]);
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

api.get('/print-preferences/:userId', requireAuth, async (req, res) => {
  assertOwnerOrAdmin(req, req.params.userId);
  res.json(rowOut('print_preferences', await one('SELECT * FROM print_preferences WHERE user_id = ?', [req.params.userId])));
});

api.put('/print-preferences/:userId', requireAuth, async (req, res) => {
  assertOwnerOrAdmin(req, req.params.userId);
  await upsertRow('print_preferences', { ...pick(req.body, PRINT_FIELDS), user_id: req.params.userId });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Administração de dados: importação, exportação, backups e registro de operações
// ---------------------------------------------------------------------------

api.get('/admin/stats', requireElevated, async (_req, res) => {
  res.json({
    counts: await countAll(),
    database: dbInfo.description,
    leastPrivilege: dbInfo.leastPrivilege,
    https: config.https.enabled,
    environment: config.environment,
    backups: listBackups().slice(0, 10),
    backupCopyDir: await getBackupCopyDir(),
    backupCopyStatus: await getBackupCopyStatus(),
  });
});

api.post('/admin/import/preview', requireElevated, async (req, res) => {
  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  if (!files.length) fail(400, 'Selecione ao menos um arquivo.');
  res.json(await previewImport(files, req.body?.overrides || {}));
});

api.post('/admin/import/apply', requireElevated, async (req, res) => {
  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  if (!files.length) fail(400, 'Selecione ao menos um arquivo.');
  const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
  try {
    const result = await applyImport(files, req.body?.overrides || {}, { mode });
    await addAudit(req.user.name, 'Alteração', 'Importação de dados', mode, files.map(f => f.name).join(', '));
    res.json({ ...result, backupFile: path.basename(result.backupFile) });
  } catch (err) {
    if (err.report) return res.status(400).json({ error: err.message, report: err.report });
    throw err;
  }
});

api.get('/admin/export', requireElevated, async (req, res) => {
  const includePasswords = req.query.passwords !== '0';
  const stamp = new Date().toISOString().slice(0, 10);
  await addAudit(req.user.name, 'Exportação', 'Exportação completa dos dados', '-', includePasswords ? 'Com senhas (hash)' : 'Sem senhas');
  res.setHeader('Content-Disposition', `attachment; filename="sisferias_exportacao_${stamp}.json"`);
  res.json(await exportAll({ includePasswords }));
});

api.get('/admin/export/:table', requireElevated, async (req, res) => {
  const table = req.params.table.replace(/\.csv$/, '');
  if (!(table in TABLES)) fail(404, 'Tabela desconhecida.');
  await addAudit(req.user.name, 'Exportação', 'Exportação de tabela (CSV)', '-', table);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${table}.csv"`);
  res.send(await exportTableCsv(table));
});

// Pasta extra para onde cada backup também é copiado (rede, outro disco).
api.put('/admin/backup-copy', requireElevated, async (req, res) => {
  const dir = String(req.body?.dir || '').trim() || null;
  let saved;
  try {
    saved = await setBackupCopyDir(dir);
  } catch (err) {
    fail(400, `Não foi possível gravar na pasta: ${err.message}`);
  }
  await addAudit(req.user.name, 'Alteração', 'Pasta de cópia dos backups', '-', saved || 'Removida');
  // Faz uma cópia imediata para confirmar que está funcionando.
  if (saved) await copyToExtraFolder(await createBackup('manual', { copy: false }));
  res.json({ backupCopyDir: saved, backupCopyStatus: await getBackupCopyStatus() });
});

api.get('/admin/backups', requireElevated, (_req, res) => res.json(listBackups()));

api.post('/admin/backups', requireElevated, async (_req, res) => {
  const file = await createBackup('manual');
  res.status(201).json({ file: path.basename(file) });
});

api.get('/admin/backups/:file', requireElevated, async (req, res) => {
  const name = path.basename(req.params.file);
  const full = path.join(config.backupDir, name);
  if (!/^sisferias_.*\.json$/.test(name) || !fs.existsSync(full)) fail(404, 'Backup não encontrado.');
  await addAudit(req.user.name, 'Exportação', 'Download de backup', '-', name);
  res.download(full, name);
});

// Registro de operações (DCTIMARINST 30-17, item 4.4).
api.get('/admin/operations', requireElevated, async (req, res) => {
  const limit = Math.min(Math.max(Math.floor(Number(req.query.limit)) || 300, 1), 2000);
  const before = Number(req.query.before) || null;
  const rows = await q(`SELECT * FROM operation_log ${before ? 'WHERE id < ?' : ''} ORDER BY id DESC LIMIT ${limit}`,
    before ? [before] : []);
  res.json(rows.map(r => ({
    id: r.id,
    at: r.at,
    user_id: r.user_id,
    user: r.user_label ? decrypt(r.user_label) : '',
    ip: r.ip ? decrypt(r.ip) : '',
    method: r.method,
    route: r.route,
    status: r.status,
    operation: r.operation,
    detail: r.detail ? decrypt(r.detail) : '',
  })));
});

// ---------------------------------------------------------------------------

api.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// eslint-disable-next-line no-unused-vars
api.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Arquivo grande demais.' });
  if (err instanceof SyntaxError) return res.status(400).json({ error: 'Dados inválidos.' });
  console.error('[api]', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});
