// Parte 5: verificação das correções dos itens 1 a 5.
import fs from 'fs';
import { chromium, check, step, setSection, db, newSession, login, api, nav, unlockSecurity, tab, shot, saveResults, QA, SHOTS } from './lib.mjs';
import { BASE } from './lib.mjs';

const browser = await chromium.launch();
const ADMIN = { login: 'admin', pass: 'Admin@456' };
const uid = (email) => db('SELECT id FROM profiles WHERE email = ?', email)[0]?.id;

const S = { admin: await newSession(browser, 'admin'), bruno: await newSession(browser, 'bruno'), carla: await newSession(browser, 'carla') };
await login(S.admin.page, ADMIN.login, ADMIN.pass);
await login(S.bruno.page, '20000002', 'Bruno@123');
await login(S.carla.page, '30000003', 'Carla@123');
const P = S.admin.page;

setSection('Item 1 — Papeleta sem internet');
await step('papeleta formatada sem internet', async () => {
  // Este ambiente NÃO alcança a internet (a CDN antiga falha aqui), então
  // é um teste real de rede interna sem internet.
  const cdn = await P.evaluate(() => fetch('https://cdn.tailwindcss.com', { mode: 'no-cors' }).then(() => 'acessível', () => 'inacessível'));
  check('ambiente de teste sem acesso à internet (CDN inacessível)', cdn === 'inacessível', cdn);
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Usuários');
  await P.locator('tr', { hasText: 'Carla Dias' }).locator('button[title="Imprimir Papeleta"]').click();
  await P.waitForTimeout(1800);
  if (!(await P.inputValue('input[placeholder="Ex: 62012.000123/2026-91"]'))) await P.fill('input[placeholder="Ex: 62012.000123/2026-91"]', '62012.000777/2026-11');
  const popupPromise = P.waitForEvent('popup', { timeout: 8000 });
  await P.click('button:has-text("Imprimir Documento")');
  const popup = await popupPromise;
  const external = [];
  popup.on('request', r => { if (!r.url().startsWith(new URL(BASE).origin)) external.push(r.url()); });
  await popup.waitForTimeout(1500);
  const html = await popup.content();
  const r = await popup.evaluate(() => ({
    display: getComputedStyle(document.querySelector('.column .flex')).display,
    font: getComputedStyle(document.querySelector('.text-\\[12px\\]')).fontSize,
  }));
  fs.writeFileSync(`${QA}/papeleta-corrigida.html`, html);
  await popup.close();
  check('papeleta não depende mais de internet (sem cdn.tailwindcss.com)', !html.includes('cdn.tailwindcss.com') && external.length === 0, external.join(', '));
  check('SEM internet, o layout da papeleta é aplicado', r.display === 'flex', `display = ${r.display}`);
  check('SEM internet, tamanhos de fonte da papeleta aplicados', r.font === '12px', `font-size = ${r.font}`);
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 850 } });
  const pg = await ctx.newPage();
  await pg.goto(BASE + '/api/health');
  await pg.setContent(html.replace('onload="window.print()"', ''), { waitUntil: 'load' });
  await pg.screenshot({ path: `${SHOTS}/item1-papeleta-sem-internet.png` });
  await ctx.close();
});

setSection('Item 2 — Prazo final no servidor');
await step('prazo definido por um admin vale para todos', async () => {
  // Ana volta a ser admin para o teste
  await unlockSecurity(P, ADMIN.pass);
  await api(P, 'PATCH', `/profiles/${uid('ana@mb.mil.br')}`, { role: 'admin', view_all_sectors: true });
  const { page: ana } = await newSession(browser, 'ana'); await login(ana, '10000001', 'Ana@1234');

  await tab(P, 'Usuários');
  await P.fill('input[type=date]', '2099-12-31'); await P.waitForTimeout(1500);
  check('prazo futuro gravado no servidor', db('SELECT vacation_deadline d FROM system_settings')[0].d === '2099-12-31');
  check('prazo futuro não bloqueia ninguém', db('SELECT COUNT(*) c FROM profiles WHERE is_blocked = 1')[0].c === 0);
  await unlockSecurity(ana, 'Ana@1234'); await tab(ana, 'Usuários');
  check('outro admin (Ana, outro navegador) vê o mesmo prazo', (await ana.inputValue('input[type=date]')) === '2099-12-31');

  await P.fill('input[type=date]', '2020-01-01'); await P.waitForTimeout(1500);
  const total = db('SELECT COUNT(*) c FROM profiles')[0].c;
  check('prazo vencido bloqueia todos pelo servidor', db('SELECT COUNT(*) c FROM profiles WHERE is_blocked = 1')[0].c === total);
  const a = db("SELECT user_name, new_value FROM audit_logs WHERE field = 'Prazo Final de Lançamento' ORDER BY timestamp DESC LIMIT 1")[0];
  check('bloqueio por prazo registrado na auditoria', !!a, a ? `${a.user_name}: ${a.new_value}` : '');

  // Exceção: admin libera o Bruno manualmente depois do prazo
  await api(P, 'PATCH', `/profiles/${uid('bruno@mb.mil.br')}`, { is_blocked: false });
  await api(P, 'PUT', '/settings', { total_manpower: 250 }); // qualquer gravação; a verificação roda periodicamente
  check('liberação manual após o prazo é respeitada (não é bloqueado de novo)', db('SELECT is_blocked b FROM profiles WHERE email = ?', 'bruno@mb.mil.br')[0].b === 0);

  // Conta nova criada depois do prazo já nasce bloqueada
  const r = await api(S.carla.page, 'POST', '/auth/register', { name: 'Eva Nova', email: 'eva@mb.mil.br', password: 'Eva@1234', nip: '50000005', sector: '20' });
  check('conta nova após o prazo nasce bloqueada', r.status === 201 && db('SELECT is_blocked b FROM profiles WHERE email = ?', 'eva@mb.mil.br')[0].b === 1);

  await P.click('button[title="Limpar prazo e liberar todos"]'); await P.waitForTimeout(1500);
  check('limpar o prazo libera todos', db('SELECT COUNT(*) c FROM profiles WHERE is_blocked = 1')[0].c === 0 && !db('SELECT vacation_deadline d FROM system_settings')[0].d);
  check('navegador não guarda mais o prazo', (await P.evaluate(() => localStorage.getItem('vacation_deadline'))) === null);
  S.ana = { page: ana };
});

setSection('Item 3 — Auditoria com o nome de quem fez');
await step('ações administrativas registram o nome real', async () => {
  const ana = S.ana.page;
  // a conta nova aparece na próxima atualização automática (aqui: voltar para a aba)
  await ana.evaluate(() => window.dispatchEvent(new Event('focus'))); await ana.waitForTimeout(1500);
  await tab(ana, 'Usuários');
  await ana.locator('tr', { hasText: 'Eva Nova' }).locator('button[title="Bloquear Manualmente"]').click(); await ana.waitForTimeout(1000);
  const a = db("SELECT user_name, field FROM audit_logs WHERE field LIKE '%Eva Nova%' ORDER BY timestamp DESC LIMIT 1")[0];
  check('bloqueio feito pela Ana aparece como "Ana Lima" na auditoria', a?.user_name === 'Ana Lima', a ? `${a.user_name}: ${a.field}` : 'sem registro');
  await tab(ana, 'Gestão de Contas');
  await ana.locator('tr', { hasText: 'eva@mb.mil.br' }).locator('button:has-text("Excluir Conta")').click();
  await ana.click('button:has-text("Sim, Excluir")'); await ana.waitForTimeout(1200);
  const d = db("SELECT user_name FROM audit_logs WHERE action = 'Exclusão' ORDER BY timestamp DESC LIMIT 1")[0];
  check('exclusão de conta feita pela Ana aparece como "Ana Lima"', d?.user_name === 'Ana Lima', d?.user_name);
  const forged = await api(S.bruno.page, 'POST', '/audit-logs', { user_name: 'Administrador', action: 'Alteração', field: 'tentativa de falsificar autor', old_value: '-', new_value: '-' });
  check('não é possível registrar auditoria em nome de outra pessoa', forged.data?.user_name === 'Bruno Costa', `gravado como: ${forged.data?.user_name}`);
  const hardcoded = db("SELECT COUNT(*) c FROM audit_logs WHERE user_name = 'Admin' AND timestamp > ?", new Date(Date.now() - 10 * 60_000).toISOString())[0].c;
  check('nenhum registro novo com o nome genérico "Admin"', hardcoded === 0, `${hardcoded}`);
});

setSection('Item 4 — Atualização automática das telas');
await step('sugestão nova aparece para o admin sem recarregar', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Sugestões');
  await api(S.bruno.page, 'POST', '/suggestions', { title: 'Sugestão ao vivo', description: 'teste', user_name: 'Bruno Costa', war_name: 'BRUNO' });
  // ao voltar para a aba do navegador (evento focus)
  await P.evaluate(() => window.dispatchEvent(new Event('focus'))); await P.waitForTimeout(1500);
  check('admin vê sugestão nova ao voltar para a aba (sem F5)', (await P.textContent('body')).includes('Sugestão ao vivo'));
});
await step('alteração de outro usuário aparece no Painel ao navegar', async () => {
  await nav(P, 'Painel');
  const e = db('SELECT id FROM employees WHERE user_id = ? AND planning_year = 2025', uid('carla@mb.mil.br'))[0];
  await api(S.carla.page, 'PATCH', `/employees/${e.id}`, { war_name: 'CARLA-AO-VIVO' });
  await nav(P, 'Início'); await nav(P, 'Painel'); await P.waitForTimeout(1000);
  check('Painel mostra alteração de outro usuário ao navegar (sem F5)', (await P.textContent('body')).includes('CARLA-AO-VIVO'));
  await api(S.carla.page, 'PATCH', `/employees/${e.id}`, { war_name: 'CARLA' });
});
await step('atualização periódica (60 s)', async () => {
  await nav(P, 'Painel');
  const e = db('SELECT id FROM employees WHERE user_id = ? AND planning_year = 2025', uid('carla@mb.mil.br'))[0];
  await api(S.carla.page, 'PATCH', `/employees/${e.id}`, { war_name: 'CARLA-60S' });
  await P.waitForTimeout(63000);
  check('Painel parado se atualiza sozinho em até 1 minuto', (await P.textContent('body')).includes('CARLA-60S'));
  await api(S.carla.page, 'PATCH', `/employees/${e.id}`, { war_name: 'CARLA' });
});
await step('atualização automática não apaga o que o usuário está digitando', async () => {
  const p = S.bruno.page; await nav(p, 'Início'); await nav(p, 'Minhas Férias'); await p.waitForTimeout(800);
  const d = p.locator('form input[type=date]');
  await d.nth(0).fill('2026-02-02');
  const name = p.locator('input[value="Bruno Costa"]');
  await name.fill('Bruno Costa Editando');
  for (let i = 0; i < 3; i++) { await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(800); }
  const kept = await d.nth(0).inputValue();
  const keptName = await p.locator('input[value="Bruno Costa Editando"]').count();
  check('dados digitados continuam no formulário após atualizações automáticas', kept === '2026-02-02' && keptName === 1, `data: ${kept}, nome mantido: ${keptName === 1}`);
});

setSection('Item 5 — "Quadro/Esp." gravado no servidor');
await step('cadastro com Quadro/Esp.', async () => {
  const { page: reg } = await newSession(browser, 'cadastro-fabio');
  await reg.goto(BASE); await reg.click('text=Cadastre-se');
  await reg.fill('input[placeholder="Seu nome completo"]', 'Fabio Reis');
  await reg.fill('input[placeholder="Nome de guerra"]', 'FABIO');
  await reg.fill('input[placeholder="Número de Identificação Pessoal"]', '60000006');
  await reg.fill('input[placeholder="Opcional"]', 'ma');
  await reg.fill('input[placeholder="seu@email.com"]', 'fabio@mb.mil.br');
  const pw = reg.locator('input[placeholder="********"]');
  await pw.nth(0).fill('Fabio@123'); await pw.nth(1).fill('Fabio@123');
  await reg.click('button[type=submit]'); await reg.waitForTimeout(1500);
  const pref = db('SELECT specialization s FROM print_preferences WHERE user_id = ?', uid('fabio@mb.mil.br'))[0];
  check('Quadro/Esp. do cadastro gravado no servidor', pref?.s === 'MA', pref?.s);
  // abre em OUTRO navegador (sem o valor guardado localmente)
  const { page: f } = await newSession(browser, 'fabio-outro-pc');
  await login(f, '60000006', 'Fabio@123');
  await nav(f, 'Minhas Férias'); await f.waitForTimeout(1500);
  check('em outro computador, o formulário mostra o Quadro/Esp. do cadastro', (await f.locator('input[placeholder="Opcional"]').inputValue()) === 'MA');
  await f.fill('input[placeholder="Opcional"]', 'AA');
  const dates = f.locator('form input[type=date]');
  await dates.nth(0).fill('2026-09-01'); await dates.nth(1).fill('2026-09-30');
  await f.click('button:has-text("Próximo")'); await f.waitForTimeout(300);
  await f.click('button[type=submit]:has-text("Salvar")'); await f.waitForTimeout(1500);
  check('alterar o Quadro/Esp. no formulário grava no servidor', db('SELECT specialization s FROM print_preferences WHERE user_id = ?', uid('fabio@mb.mil.br'))[0]?.s === 'AA');
  const { page: f2 } = await newSession(browser, 'fabio-terceiro-pc');
  await login(f2, '60000006', 'Fabio@123'); await nav(f2, 'Impressão'); await f2.waitForTimeout(1800);
  check('papeleta usa o Quadro/Esp. gravado (em outro computador)', (await f2.locator('input[placeholder="Opcional"]').inputValue()) === 'AA');
});

console.log('\nerros de console:', Object.fromEntries(Object.entries(S).map(([k, s]) => [k, (s.page.__errors || []).filter(e => !e.includes('403') && !e.includes('401'))])));
saveResults(`${QA}/r5.json`);
await browser.close();
