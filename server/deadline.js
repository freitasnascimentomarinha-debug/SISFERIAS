// Prazo final de lançamento de férias.
//
// O prazo fica gravado no servidor (system_settings.vacation_deadline) e vale
// para todos os administradores. Quando o dia do prazo termina, todos os
// usuários são bloqueados UMA vez por prazo (deadline_applied_for): se um
// administrador liberar alguém depois, a verificação seguinte não o bloqueia
// de novo.

import { one, run, addAudit } from './db.js';

const getSettings = async () => (await one('SELECT vacation_deadline, deadline_applied_for FROM system_settings WHERE id = 1')) || {};

/** Verdadeiro quando o dia do prazo (horário do servidor) já terminou. */
export function deadlinePassed(deadline) {
  if (!deadline) return false;
  const end = new Date(`${deadline}T23:59:59.999`); // horário local do servidor
  return !Number.isNaN(end.getTime()) && Date.now() > end.getTime();
}

/** O prazo atual já venceu e o bloqueio geral já foi aplicado. */
export async function deadlineInForce() {
  const s = await getSettings();
  return !!s.vacation_deadline && s.deadline_applied_for === s.vacation_deadline;
}

/** Aplica o bloqueio geral se o prazo venceu e ainda não foi aplicado. Retorna true se bloqueou. */
export async function applyDeadline(userName = 'Sistema') {
  const s = await getSettings();
  if (!deadlinePassed(s.vacation_deadline) || s.deadline_applied_for === s.vacation_deadline) return false;
  await run('UPDATE profiles SET is_blocked = TRUE, updated_at = now()');
  await run('UPDATE system_settings SET deadline_applied_for = ? WHERE id = 1', [s.vacation_deadline]);
  await addAudit(userName, 'Bloqueio', 'Prazo Final de Lançamento', s.vacation_deadline, 'Prazo vencido: lançamentos bloqueados para todos');
  console.log(`[prazo] prazo ${s.vacation_deadline} vencido: lançamentos bloqueados para todos.`);
  return true;
}

/** Define (ou limpa, com null) o prazo. Limpar libera todos os usuários. */
export async function setDeadline(deadline, userName) {
  const previous = (await getSettings()).vacation_deadline || null;
  if (deadline) {
    await run('UPDATE system_settings SET vacation_deadline = ?, deadline_applied_for = NULL, updated_at = now() WHERE id = 1', [deadline]);
    await addAudit(userName, 'Alteração', 'Prazo Final de Lançamento', previous || 'Sem prazo', deadline);
    return { blocked: await applyDeadline(userName) };
  }
  await run('UPDATE system_settings SET vacation_deadline = NULL, deadline_applied_for = NULL, updated_at = now() WHERE id = 1');
  await run('UPDATE profiles SET is_blocked = FALSE, updated_at = now()');
  await addAudit(userName, 'Bloqueio', 'Prazo Final de Lançamento', previous || 'Sem prazo', 'Prazo removido: liberado para todos');
  return { blocked: false };
}

/** Verifica o prazo ao iniciar e a cada 10 minutos. */
export function scheduleDeadlineCheck() {
  const check = () => applyDeadline().catch(err => console.error('[prazo] falha na verificação:', err.message));
  void check();
  setInterval(check, 10 * 60_000).unref();
}
