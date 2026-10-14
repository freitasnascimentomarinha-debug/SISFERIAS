// Parte 1: cadastro das contas, login, papéis, visibilidade por setor.
import { chromium, check, step, setSection, db, newSession, login, api, nav, unlockSecurity, tab, shot, saveResults, QA } from './lib.mjs';
import { BASE } from './lib.mjs';

const browser = await chromium.launch();
export const ACCOUNTS = {
  admin: { login: 'admin', pass: 'Admin@123' },
  ana:   { name: 'Ana Lima',    war: 'ANA',   nip: '10000001', email: 'ana@mb.mil.br',   pass: 'Ana@1234',   cat: 'oficial', rank: 'CT',  sector: '10' },
  bruno: { name: 'Bruno Costa', war: 'BRUNO', nip: '20000002', email: 'bruno@mb.mil.br', pass: 'Bruno@123',  cat: 'praca',   rank: 'CB',  sector: '10' },
  carla: { name: 'Carla Dias',  war: 'CARLA', nip: '30000003', email: 'carla@mb.mil.br', pass: 'Carla@123',  cat: 'praca',   rank: '3SG', sector: '20' },
  davi:  { name: 'Davi Rocha',  war: 'DAVI',  nip: '40000004', email: 'davi@mb.mil.br',  pass: 'Davi@1234',  cat: 'civil',   rank: 'SC',  sector: '20' },
};

setSection('1. Cadastro de contas (tela Cadastre-se)');
const { page: reg } = await newSession(browser, 'cadastro');
for (const key of ['ana', 'bruno', 'carla', 'davi']) {
  const a = ACCOUNTS[key];
  await step(`cadastro ${a.name}`, async () => {
    await reg.goto(BASE);
    await reg.click('text=Cadastre-se');
    await reg.fill('input[placeholder="Seu nome completo"]', a.name);
    await reg.fill('input[placeholder="Nome de guerra"]', a.war);
    await reg.fill('input[placeholder="Número de Identificação Pessoal"]', a.nip);
    const selects = reg.locator('form select');
    await selects.nth(0).selectOption(a.cat);
    await selects.nth(1).selectOption(a.rank);
    await selects.nth(2).selectOption(a.sector);
    await reg.fill('input[placeholder="seu@email.com"]', a.email);
    const pw = reg.locator('input[placeholder="********"]');
    await pw.nth(0).fill(a.pass); await pw.nth(1).fill(a.pass);
    await reg.click('button[type=submit]');
    const ok = await reg.waitForSelector('text=Cadastro realizado', { timeout: 5000 }).then(() => true).catch(() => false);
    const row = db('SELECT * FROM profiles WHERE email = ?', a.email)[0];
    check(`cadastro ${a.name}`, ok && row && row.nip === a.nip && row.sector === a.sector && row.rank === a.rank && row.category === a.cat && row.role === 'user',
      row ? `perfil gravado: setor ${row.sector}, ${row.category}/${row.rank}, papel ${row.role}` : 'perfil não gravado');
  });
}
await step('cadastro duplicado (mesmo e-mail) é recusado', async () => {
  await reg.goto(BASE); await reg.click('text=Cadastre-se');
  const a = ACCOUNTS.bruno;
  await reg.fill('input[placeholder="Seu nome completo"]', 'Outro Bruno');
  await reg.fill('input[placeholder="Nome de guerra"]', 'X');
  await reg.fill('input[placeholder="Número de Identificação Pessoal"]', '99999999');
  await reg.fill('input[placeholder="seu@email.com"]', a.email);
  const pw = reg.locator('input[placeholder="********"]');
  await pw.nth(0).fill('qwerty12'); await pw.nth(1).fill('qwerty12');
  await reg.click('button[type=submit]'); await reg.waitForTimeout(1200);
  const n = db('SELECT COUNT(*) c FROM profiles WHERE email = ?', a.email)[0].c;
  check('cadastro duplicado (mesmo e-mail) é recusado', n === 1 && !(await reg.isVisible('text=Cadastro realizado')),
    (await reg.textContent('form')).match(/já|cadastrad|exist/i)?.[0] ? 'mensagem exibida' : 'sem mensagem clara');
});
await step('cadastro com NIP repetido é recusado', async () => {
  const r = await api(reg, 'POST', '/auth/register', { name: 'Clone', email: 'clone@mb.mil.br', password: '123456', nip: ACCOUNTS.carla.nip });
  check('cadastro com NIP repetido é recusado', r.status === 409, `${r.status} ${r.data?.error}`);
});

setSection('2. Login e sessão');
const sessions = {};
for (const key of Object.keys(ACCOUNTS)) sessions[key] = await newSession(browser, key);
await step('login errado', async () => {
  const p = sessions.bruno.page;
  await p.goto(BASE);
  await p.fill('input[type=text]', ACCOUNTS.bruno.nip); await p.fill('input[type=password]', 'errada');
  await p.click('button[type=submit]'); await p.waitForTimeout(900);
  check('senha errada é recusada com mensagem', await p.isVisible('text=incorretos'));
});
check('login admin (NIP "admin")', await login(sessions.admin.page, 'admin', ACCOUNTS.admin.pass));
check('login Ana por e-mail', await login(sessions.ana.page, ACCOUNTS.ana.email, ACCOUNTS.ana.pass));
for (const key of ['bruno', 'carla', 'davi']) check(`login ${key} por NIP`, await login(sessions[key].page, ACCOUNTS[key].nip, ACCOUNTS[key].pass));
await step('sessão sobrevive a recarregar a página', async () => {
  const p = sessions.bruno.page; await p.reload(); await p.waitForTimeout(1000);
  check('sessão sobrevive a recarregar a página', await p.isVisible('header >> text=Minhas Férias'));
});
await step('menu do usuário comum', async () => {
  const h = await sessions.bruno.page.textContent('header');
  check('usuário comum NÃO vê Painel/Calendário/Segurança', !/Painel|Calendário|Segurança|Trâmite|Justificativas/.test(h), h.replace(/\s+/g, ' ').slice(0, 120));
});
await step('menu do admin', async () => {
  const h = await sessions.admin.page.textContent('header');
  check('admin vê todos os menus', ['Painel', 'Calendário', 'Justificativas', 'Trâmite', 'Segurança'].every(m => h.includes(m)));
});

setSection('3. Papéis: promover Ana a administradora');
await step('desbloquear Segurança', async () => {
  check('admin desbloqueia Segurança com a própria senha', await unlockSecurity(sessions.admin.page, ACCOUNTS.admin.pass));
});
await step('promover Ana', async () => {
  const p = sessions.admin.page;
  await tab(p, 'Gestão de Contas');
  const row = p.locator('tr', { hasText: ACCOUNTS.ana.email });
  await row.locator('button').first().click();
  await p.waitForTimeout(1000);
  const r = db('SELECT role FROM profiles WHERE email = ?', ACCOUNTS.ana.email)[0];
  check('Ana promovida a admin (gravado no banco)', r.role === 'admin', `papel: ${r.role}`);
  await shot(p, '03-gestao-contas');
});
await step('Ana passa a ver menus de admin após entrar de novo', async () => {
  const p = sessions.ana.page; await p.reload(); await p.waitForTimeout(1200);
  const h = await p.textContent('header');
  check('Ana passa a ver menus de admin', h.includes('Painel') && h.includes('Segurança'));
});
await step('visibilidade padrão de Ana', async () => {
  const r = db('SELECT view_all_sectors v FROM profiles WHERE email = ?', ACCOUNTS.ana.email)[0];
  check('admin promovida começa restrita ao próprio setor (view_all_sectors = 0)', r.v === 0);
});

console.log('\nerros de console:', Object.fromEntries(Object.entries(sessions).map(([k, s]) => [k, s.page.__errors])));
saveResults(`${QA}/r1.json`);
await browser.close();
