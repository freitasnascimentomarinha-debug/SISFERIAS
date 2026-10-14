// Parte 3b: refaz os itens que falharam por seletor e investiga as causas.
import fs from 'fs';
import { chromium, check, step, setSection, db, newSession, login, api, nav, unlockSecurity, tab, shot, saveResults, QA, SHOTS } from './lib.mjs';

const browser = await chromium.launch();
const ADMIN = { login: 'admin', pass: 'Admin@45678' };
const BRUNO = { nip: '20000002', pass: 'Bruno@12345', email: 'bruno@mb.mil.br' };
const CARLA = { nip: '30000003', pass: 'Carla@12345', email: 'carla@mb.mil.br', name: 'Carla Dias' };
const uid = (email) => db('SELECT id FROM profiles WHERE email = ?', email)[0]?.id;
const emp = (email, year = 2025) => {
  const r = db('SELECT * FROM employees WHERE user_id = ? AND planning_year = ?', uid(email), year)[0];
  if (r) r.parcels = JSON.parse(r.vacation_parcels);
  return r;
};

const S = { admin: await newSession(browser, 'admin'), bruno: await newSession(browser, 'bruno') };
await login(S.admin.page, ADMIN.login, ADMIN.pass);
await login(S.bruno.page, BRUNO.nip, BRUNO.pass);
const P = S.admin.page;

setSection('9b. Papeleta da Carla gerada pelo admin, com e sem internet');
await step('papeleta da Carla', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Usuários');
  await P.locator('tr', { hasText: CARLA.name }).locator('button[title="Imprimir Papeleta"]').click();
  await P.waitForTimeout(1800);
  await P.fill('input[placeholder="Ex: 62012.000123/2026-91"]', '62012.000777/2026-11');
  const popupPromise = P.waitForEvent('popup', { timeout: 8000 });
  await P.click('button:has-text("Imprimir Documento")');
  const popup = await popupPromise; await popup.waitForTimeout(1500);
  const html = await popup.content();
  await popup.close();
  fs.writeFileSync(`${QA}/papeleta.html`, html);
  check('papeleta do admin para a Carla abre com nome, NUP e endereço',
    html.includes('CARLA') && html.includes('62012.000777/2026-11') && html.includes('Rua das Flores'));
  check('papeleta não carrega estilo da internet', !html.includes('cdn.tailwindcss.com'));

});

setSection('10b. Trâmite');
await step('Trâmite: admin corrige NUP', async () => {
  await nav(P, 'Trâmite'); await P.waitForTimeout(800);
  const row = P.locator('tr', { hasText: '62012.000999/2026-33' }).first();
  const hasRow = await row.count();
  const target = hasRow ? row : P.locator('tr', { hasText: 'BRUNO' }).first();
  await target.locator('button[title="Inserir ou corrigir NUP"]').click();
  await P.locator('tr input[placeholder="Ex: 62012.000123/2026-91"]').fill('62012.000999/2026-44');
  await P.click('button[title="Salvar NUP"]'); await P.waitForTimeout(900);
  const nups = emp(BRUNO.email).parcels.map(p => p.nup || '-');
  check('NUP corrigido no Trâmite e gravado', nups.includes('62012.000999/2026-44'), nups.join(', '));
  await shot(P, '10-tramite');
});

setSection('11b. Avisos');
await step('fixar e excluir aviso', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Sistema');
  await P.fill('input[placeholder="Ex: Novo prazo de entrega"]', 'Aviso QA');
  await P.fill('textarea[placeholder="Escreva o comunicado aqui..."]', 'Conteúdo QA');
  await P.locator('button', { hasText: /Publicar|Adicionar|Enviar/ }).first().click(); await P.waitForTimeout(1000);
  const card = P.locator('div.flex-1:has(h4:text-is("Aviso QA"))').locator('xpath=..');
  await card.locator('button[title="Fixar no topo"]').click(); await P.waitForTimeout(900);
  check('aviso fixado (gravado)', db("SELECT is_pinned p FROM notices WHERE title = 'Aviso QA'")[0]?.p === 1);
  await card.locator('button').nth(1).click(); await P.waitForTimeout(400);
  await P.click('button:has-text("Sim, Excluir")'); await P.waitForTimeout(900);
  check('aviso excluído', db("SELECT COUNT(*) c FROM notices WHERE title = 'Aviso QA'")[0].c === 0);
  // sobras do teste anterior
  const old = db("SELECT COUNT(*) c FROM notices WHERE title = 'Prazo de férias 2026'")[0].c;
  if (old) await api(P, 'DELETE', `/notices/${db("SELECT id FROM notices WHERE title = 'Prazo de férias 2026'")[0].id}`);
});

setSection('11c. Sugestões e atualização dos dados na tela');
await step('sugestão aparece para o admin', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Sugestões');
  // Bruno envia DEPOIS que o admin já abriu a tela
  await nav(S.bruno.page, 'Início');
  await S.bruno.page.locator('button').filter({ hasText: /^$/ }).last().click().catch(() => {});
  const r = await api(S.bruno.page, 'POST', '/suggestions', { title: 'Sugestão QA', description: 'Descrição QA', user_name: 'Bruno Costa', war_name: 'BRUNO' });
  check('usuário envia sugestão', r.status === 201);
  await P.evaluate(() => window.dispatchEvent(new Event('focus'))); // volta para a aba
  await P.waitForTimeout(1500);
  const semRecarregar = (await P.textContent('body')).includes('Sugestão QA');
  check('admin vê sugestão nova ao voltar para a aba (sem F5)', semRecarregar, semRecarregar ? '' : 'só aparece após recarregar');
  await P.reload(); await P.waitForTimeout(1200);
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Sugestões');
  check('admin vê a sugestão após recarregar', (await P.textContent('body')).includes('Sugestão QA'));
  await P.click('button[title="Excluir sugestão de Bruno Costa"]'); await P.waitForTimeout(900);
  check('admin exclui a sugestão', db("SELECT COUNT(*) c FROM suggestions WHERE title = 'Sugestão QA'")[0].c === 0);
});
await step('tela de sugestões do usuário', async () => {
  const p = S.bruno.page; await nav(p, 'Início');
  const help = p.locator('button[title*="juda"], button:has-text("?")').first();
  if (await help.count()) await help.click();
  await p.waitForTimeout(400);
  const link = p.locator('button:has-text("Sugest")').first();
  if (await link.count()) {
    await link.click(); await p.waitForTimeout(800);
    await p.locator('input').first().fill('Sugestão pela tela');
    await p.locator('textarea').first().fill('Enviada pelo formulário');
    await p.locator('button[type=submit], button:has-text("Enviar")').first().click(); await p.waitForTimeout(1200);
    check('usuário envia sugestão pela tela', db("SELECT COUNT(*) c FROM suggestions WHERE title = 'Sugestão pela tela'")[0].c === 1);
  } else check('usuário encontra a tela de sugestões no Início', false, 'botão não encontrado');
});
await step('lançamento novo aparece no Painel do admin sem recarregar?', async () => {
  await nav(P, 'Painel');
  const before = (await P.textContent('body')).includes('FÉRIAS-QA');
  const ana = uid('ana@mb.mil.br');
  // Ana (agora usuária) altera seu nome de guerra no lançamento via API
  const { page: a } = await newSession(browser, 'ana'); await login(a, '10000001', 'Ana@123456');
  const e = db('SELECT id FROM employees WHERE user_id = ?', ana)[0];
  await api(a, 'PATCH', `/employees/${e.id}`, { war_name: 'ANA-QA' });
  await nav(P, 'Início'); await nav(P, 'Painel'); await P.waitForTimeout(800);
  const sem = (await P.textContent('body')).includes('ANA-QA');
  check('alteração de outro usuário aparece no Painel ao navegar (sem recarregar)', sem, sem ? '' : 'só aparece após recarregar a página (F5)');
  await api(a, 'PATCH', `/employees/${e.id}`, { war_name: 'ANA' });
});

console.log('\nerros de console:', Object.fromEntries(Object.entries(S).map(([k, s]) => [k, s.page.__errors.filter(e => !e.includes('403') && !e.includes('401'))])));
saveResults(`${QA}/r3b.json`);
await browser.close();
