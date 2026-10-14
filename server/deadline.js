// Prazo final de lançamento de férias.
//
// O prazo fica gravado no servidor (system_settings.vacation_deadline) e vale
// para todos os administradores. Quando o dia do prazo termina, todos os
// usuários são bloqueados UMA vez por prazo (deadline_applied_for): se um
// administrador liberar alguém depois, a verificação seguinte não o bloqueia
// de novo.

import { db, nowIso, newId, upsertRow } from './db.js';

const getSettings = () => db.prepare('SELECT vacation_deadline, deadline_applied_for FROM system_settings WHERE id = 1').get() || {};

/** Verdadeiro quando o dia do prazo (horário do servidor) já terminou. */
export function deadlinePassed(deadline) {
  if (!deadline) return false;
  const end = new Date(`${deadline}T23:59:59.999`); // horário local do servidor
  return !Number.isNaN(end.getTime()) && Date.now() > end.getTime();
}

/** O prazo atual já venceu e o bloqueio geral já foi aplicado. */
export function deadlineInForce() {
  const s = getSettings();
  return !!s.vacation_deadline && s.deadline_applied_for === s.vacation_deadline;
}

/** Aplica o bloqueio geral se o prazo venceu e ainda não foi aplicado. Retorna true se bloqueou. */
export function applyDeadline(userName = 'Sistema') {
  const s = getSettings();
  if (!deadlinePassed(s.vacation_deadline) || s.deadline_applied_for === s.vacation_deadline) return false;
  db.prepare('UPDATE profiles SET is_blocked = 1, updated_at = ?').run(nowIso());
  db.prepare('UPDATE system_settings SET deadline_applied_for = ? WHERE id = 1').run(s.vacation_deadline);
  upsertRow('audit_logs', {
    id: newId(), timestamp: nowIso(), user_name: userName, action: 'Bloqueio',
    field: 'Prazo Final de Lançamento', old_value: s.vacation_deadline, new_value: 'Prazo vencido: lançamentos bloqueados para todos',
  });
  console.log(`[prazo] prazo ${s.vacation_deadline} vencido: lançamentos bloqueados para todos.`);
  return true;
}

/** Define (ou limpa, com null) o prazo. Limpar libera todos os usuários. */
export function setDeadline(deadline, userName) {
  const previous = getSettings().vacation_deadline || null;
  if (deadline) {
    db.prepare('UPDATE system_settings SET vacation_deadline = ?, deadline_applied_for = NULL, updated_at = ? WHERE id = 1')
      .run(deadline, nowIso());
    upsertRow('audit_logs', {
      id: newId(), timestamp: nowIso(), user_name: userName, action: 'Alteração',
      field: 'Prazo Final de Lançamento', old_value: previous || 'Sem prazo', new_value: deadline,
    });
    return { blocked: applyDeadline(userName) };
  }
  db.prepare('UPDATE system_settings SET vacation_deadline = NULL, deadline_applied_for = NULL, updated_at = ? WHERE id = 1').run(nowIso());
  db.prepare('UPDATE profiles SET is_blocked = 0, updated_at = ?').run(nowIso());
  upsertRow('audit_logs', {
    id: newId(), timestamp: nowIso(), user_name: userName, action: 'Bloqueio',
    field: 'Prazo Final de Lançamento', old_value: previous || 'Sem prazo', new_value: 'Prazo removido: liberado para todos',
  });
  return { blocked: false };
}

/** Verifica o prazo ao iniciar e a cada 10 minutos. */
export function scheduleDeadlineCheck() {
  applyDeadline();
  setInterval(() => {
    try { applyDeadline(); } catch (err) { console.error('[prazo] falha na verificação:', err.message); }
  }, 10 * 60_000).unref();
}
