// Etapa 9: requisitos das normas da DCTIM vistos pela tela.
import { chromium, check, step, setSection, db, newSession, login, api, unlockSecurity, tab, shot, saveResults, QA, BASE } from './lib.mjs';

const browser = await chromium.launch();
const ADMIN = { login: 'admin', pass: 'Admin@45678' };
const { page: P } = await newSession(browser, 'admin'); await login(P, ADMIN.login, ADMIN.pass);

setSection('DCTIMBOTEC 31/002 — 3.1.d e 3.1.e (cache e autocompletar)');
await step('página sem cache e formulários sem autocompletar', async () => {
  const { page } = await newSession(browser, 'anon');
  const res = await page.goto(BASE);
  check('página principal com Cache-Control: no-store', res.headers()['cache-control'] === 'no-store', res.headers()['cache-control']);
  await page.waitForSelector('text=Entrar');
  const ac = await page.evaluate(() => [...document.querySelectorAll('form, input')].map(e => e.getAttribute('autocomplete')));
  check('login: formulário e campos com autocomplete="off"', ac.length >= 3 && ac.every(v => v === 'off'), ac.join(','));
  check('aviso de bloqueio após 5 tentativas na tela de login', await page.isVisible('text=bloqueada após 5 tentativas'));
});

setSection('3.2.d — troca obrigatória da senha provisória');
await step('senha redefinida pelo admin obriga a troca antes de usar o sistema', async () => {
  await unlockSecurity(P, ADMIN.pass);
  const bruno = db("SELECT id FROM profiles WHERE email = 'bruno@mb.mil.br'")[0].id;
  const r = await api(P, 'POST', '/admin/reset-password', { userId: bruno, password: 'Provis@2026' });
  check('admin redefine a senha (provisória)', r.status === 200 && r.data.mustChange === true);
  const { page: B } = await newSession(browser, 'bruno');
  await login(B, '20000002', 'Provis@2026');
  check('tela de troca obrigatória aparece', await B.isVisible('text=Defina uma Nova Senha'));
  check('sem botão de fechar: só "Sair" ou salvar', !(await B.isVisible('[aria-label=Fechar]')) && await B.isVisible('.fixed button:has-text("Sair")'));
  const blocked = await api(B, 'GET', '/employees');
  check('servidor recusa outras operações até trocar', blocked.status === 403 && blocked.data.code === 'password_change_required');
  const pw = B.locator('.fixed input[type=password]');
  await pw.nth(0).fill('Provis@2026'); await pw.nth(1).fill('fraca'); await pw.nth(2).fill('fraca');
  check('checklist mostra o que falta', (await B.locator('[data-testid=regras-senha] li.text-green-600').count()) === 1);
  await B.click('.fixed button[type=submit]'); await B.waitForTimeout(500);
  check('senha fraca recusada na tela', await B.isVisible('text=pelo menos 10 caracteres'));
  await pw.nth(1).fill('Bruno@12345'); await pw.nth(2).fill('Bruno@12345');
  await B.click('.fixed button[type=submit]'); await B.waitForTimeout(2500);
  check('após trocar, o sistema libera o uso', !(await B.isVisible('text=Defina uma Nova Senha')) && (await api(B, 'GET', '/employees')).status === 200);
  await shot(B, 't9-troca-obrigatoria');
});

setSection('3.2.f e 3.2.g — mensagem genérica e bloqueio após 5 tentativas');
await step('conta bloqueada e liberada pelo administrador', async () => {
  const { page: C } = await newSession(browser, 'carla-erros');
  const msgs = [];
  for (let i = 1; i <= 5; i += 1) {
    await login(C, '30000003', `Errada@000${i}`);
    msgs.push(await C.textContent('.bg-red-50'));
  }
  const { page: N } = await newSession(browser, 'inexistente');
  await login(N, '88888888', 'Qualquer@123');
  const unknown = await N.textContent('.bg-red-50');
  check('mesma mensagem para senha errada e usuário inexistente', msgs[0] === unknown && /Usuário e\/ou senha inválidos/.test(unknown), unknown);
  check('senha certa não entra com a conta bloqueada', !(await login(C, '30000003', 'Carla@12345')));
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Gestão de Contas');
  const row = P.locator('tr', { hasText: 'carla@mb.mil.br' });
  check('Gestão de Contas mostra a conta bloqueada', await row.locator('[data-testid=conta-bloqueada]').isVisible());
  await shot(P, 't9-conta-bloqueada');
  await row.locator('button:has-text("Desbloquear")').click(); await P.waitForTimeout(1000);
  check('botão Desbloquear libera a conta', !(await row.locator('[data-testid=conta-bloqueada]').isVisible()));
  check('Carla volta a entrar', await login(C, '30000003', 'Carla@12345'));
});

setSection('DCTIMARINST 30-17 — 4.4 registro de operações');
await step('aba Registro de Operações', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Registro de Operações');
  await P.waitForSelector('[data-testid=registro-operacoes]');
  const text = await P.textContent('[data-testid=registro-operacoes]');
  check('lista logins e operações', /Login/.test(text) && /Redefinição de senha/.test(text));
  check('tentativas recusadas aparecem', /Recusada/.test(text));
  check('mostra quem fez (nome decifrado)', /Administrador/.test(text) && /Carla Dias/.test(text));
  await P.check('text=Só recusadas/erros');
  const refused = await P.locator('[data-testid=registro-operacoes] tbody tr').count();
  check('filtro de recusadas funciona', refused >= 5, `${refused} linha(s)`);
  await shot(P, 't9-registro-operacoes');
});

setSection('30-17 4.3 — ambiente');
await step('produção não mostra a faixa de homologação', async () => {
  check('sem faixa de homologação em produção', !(await P.isVisible('text=use somente dados fictícios')));
});

saveResults(`${QA}/r9.json`);
await browser.close();
