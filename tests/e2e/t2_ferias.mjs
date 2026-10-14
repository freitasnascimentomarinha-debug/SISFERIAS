// Parte 2: lançamentos de férias pelos usuários, validações, edição, persistência.
import { chromium, check, step, setSection, db, newSession, login, api, nav, shot, saveResults, QA } from './lib.mjs';

const browser = await chromium.launch();
const A = {
  bruno: { nip: '20000002', pass: 'Bruno@123', email: 'bruno@mb.mil.br' },
  carla: { nip: '30000003', pass: 'Carla@123', email: 'carla@mb.mil.br' },
  davi:  { nip: '40000004', pass: 'Davi@1234', email: 'davi@mb.mil.br' },
};
const uid = (email) => db('SELECT id FROM profiles WHERE email = ?', email)[0].id;
const emp = (email) => {
  const r = db('SELECT * FROM employees WHERE user_id = ? ORDER BY planning_year DESC', uid(email))[0];
  if (r) r.parcels = JSON.parse(r.vacation_parcels);
  return r;
};

// Abre o formulário do zero (passando pelo Início para reiniciar a tela).
async function openForm(page) {
  await nav(page, 'Início');
  await nav(page, 'Minhas Férias');
  await page.waitForTimeout(600);
}

// Preenche o formulário "Minhas Férias" e salva.
async function fillForm(page, parcels, { justification = '', parcelCount } = {}) {
  await page.waitForSelector('text=Dividir em quantas parcelas');
  const countSel = page.locator('select:near(:text("Dividir em quantas parcelas"))').first();
  await countSel.selectOption(String(parcelCount ?? parcels.length));
  await page.waitForTimeout(200);
  const dates = page.locator('form input[type=date]');
  for (let i = 0; i < parcels.length; i++) {
    await dates.nth(i * 2).fill(parcels[i][0]);
    await dates.nth(i * 2 + 1).fill(parcels[i][1]);
  }
  await page.click('button:has-text("Próximo")');
  await page.waitForTimeout(300);
  if (justification) await page.fill('form textarea', justification);
  await page.click('button[type=submit]:has-text("Salvar")');
  await page.waitForTimeout(1500);
}

const S = {};
for (const k of Object.keys(A)) { S[k] = await newSession(browser, k); await login(S[k].page, A[k].nip, A[k].pass); }

setSection('4. Lançamento de férias pelos usuários');
await step('formulário pré-preenchido com o cadastro', async () => {
  const p = S.bruno.page; await openForm(p);
  const values = await p.locator('form input:not([type=date]):not([type=file])').evaluateAll(els => els.map(e => e.value));
  check('formulário novo vem preenchido com nome, nome de guerra e NIP do cadastro',
    values.includes('Bruno Costa') && values.includes('BRUNO') && values.includes('20000002'), values.filter(Boolean).join(' | '));
});
await step('validação: dias acima do direito', async () => {
  const p = S.bruno.page; await openForm(p);
  await fillForm(p, [['2026-01-05', '2026-01-24'], ['2026-07-01', '2026-07-20']]); // 20 + 20 = 40 > 30
  check('bloqueia salvar com mais dias que o direito (40 > 30)', await p.isVisible('text=ultrapassando o limite') && !emp(A.bruno.email));
});
await step('validação: início depois do término', async () => {
  const p = S.bruno.page; await openForm(p);
  await fillForm(p, [['2026-02-20', '2026-02-10']]);
  const txt = await p.textContent('body');
  check('bloqueia salvar com início posterior ao término', !emp(A.bruno.email), /posterior|limite|inválid/i.test(txt) ? 'mensagem exibida' : 'sem mensagem visível');
  await shot(p, '04-validacao-datas');
});
await step('Bruno lança 2 parcelas', async () => {
  const p = S.bruno.page; await openForm(p);
  await fillForm(p, [['2026-01-05', '2026-01-19'], ['2026-07-01', '2026-07-15']], { justification: 'Viagem em família' });
  const e = emp(A.bruno.email);
  check('Bruno: lançamento gravado com 2 parcelas de 15 dias', e && e.parcels.length === 2 && e.parcels[0].days === 15 && e.parcels[1].days === 15 && e.planning_year === 2025,
    e ? `ano ${e.planning_year}, parcelas ${e.parcels.map(x => `${x.startDate}..${x.endDate} (${x.days}d)`).join(', ')}, justificativa "${e.justification}"` : 'nada gravado');
  check('após salvar, usuário volta ao Início', await p.isVisible('header >> text=Início') && !(await p.isVisible('text=Dividir em quantas parcelas')));
});
await step('Carla lança 1 parcela de 30 dias', async () => {
  const p = S.carla.page; await openForm(p);
  await fillForm(p, [['2026-11-02', '2026-12-01']]);
  const e = emp(A.carla.email);
  check('Carla: 1 parcela de 30 dias gravada', e && e.parcels.length === 1 && e.parcels[0].days === 30, e ? JSON.stringify(e.parcels.map(x => x.days)) : 'nada');
});
await step('Davi lança 1 parcela de 20 dias', async () => {
  const p = S.davi.page; await openForm(p);
  await fillForm(p, [['2026-03-02', '2026-03-21']]);
  const e = emp(A.davi.email);
  check('Davi: 1 parcela de 20 dias gravada (saldo 10)', e && e.parcels[0].days === 20, e ? `${e.parcels[0].days} dias` : 'nada');
});

setSection('5. Edição pelo próprio usuário e persistência');
await step('formulário reabre com os dados salvos', async () => {
  const p = S.bruno.page; await openForm(p);
  await p.waitForTimeout(800);
  const dates = await p.locator('form input[type=date]').evaluateAll(els => els.map(e => e.value));
  check('ao reabrir, o formulário mostra as parcelas salvas', dates.join(',') === '2026-01-05,2026-01-19,2026-07-01,2026-07-15', dates.join(','));
});
await step('Bruno altera a 2ª parcela', async () => {
  const p = S.bruno.page; await openForm(p); await p.waitForTimeout(600);
  const before = emp(A.bruno.email);
  await fillForm(p, [['2026-01-05', '2026-01-19'], ['2026-08-03', '2026-08-17']]);
  const e = emp(A.bruno.email);
  check('alteração da 2ª parcela gravada', e.parcels[1].startDate === '2026-08-03' && e.parcels[1].endDate === '2026-08-17');
  check('a alteração atualiza o mesmo registro (sem duplicar)', e.id === before.id && db('SELECT COUNT(*) c FROM employees WHERE user_id = ?', e.user_id)[0].c === 1);
});
await step('alteração aparece após recarregar', async () => {
  const p = S.bruno.page; await p.reload(); await p.waitForTimeout(1000);
  await openForm(p); await p.waitForTimeout(800);
  const dates = await p.locator('form input[type=date]').evaluateAll(els => els.map(e => e.value));
  check('após recarregar a página, a alteração continua lá', dates.includes('2026-08-03'), dates.join(','));
});
await step('Bruno reduz para 1 parcela', async () => {
  const p = S.bruno.page; await openForm(p); await p.waitForTimeout(600);
  await fillForm(p, [['2026-01-05', '2026-01-19']], { parcelCount: 1 });
  const e = emp(A.bruno.email);
  check('reduzir de 2 para 1 parcela remove a 2ª', e.parcels.length === 1, `${e.parcels.length} parcela(s)`);
  // volta às 2 parcelas para os próximos testes
  await openForm(p); await p.waitForTimeout(600);
  await fillForm(p, [['2026-01-05', '2026-01-19'], ['2026-08-03', '2026-08-17']]);
  check('voltar para 2 parcelas grava novamente', emp(A.bruno.email).parcels.length === 2);
});
await step('lançamento de outro ano (2026) cria registro separado', async () => {
  const p = S.carla.page; await openForm(p); await p.waitForTimeout(600);
  await p.locator('form select').first().selectOption('2026');
  await p.waitForTimeout(600);
  await fillForm(p, [['2027-02-01', '2027-02-10']]);
  const rows = db('SELECT planning_year FROM employees WHERE user_id = ? ORDER BY planning_year', uid(A.carla.email)).map(r => r.planning_year);
  check('Carla tem lançamentos separados para 2025 e 2026', rows.join(',') === '2025,2026', rows.join(','));
});

setSection('6. Proteções do servidor para usuário comum');
await step('Bruno não altera férias da Carla pela API', async () => {
  const carlaEmp = emp(A.carla.email);
  const r = await api(S.bruno.page, 'PATCH', `/employees/${carlaEmp.id}`, { vacation_parcels: [] });
  check('usuário comum não altera férias de outro (403)', r.status === 403, `${r.status} ${r.data?.error}`);
  const r2 = await api(S.bruno.page, 'POST', '/employees', { user_id: carlaEmp.user_id, planning_year: 2025, vacation_parcels: [] });
  check('usuário comum não cria lançamento em nome de outro (403)', r2.status === 403, `${r2.status}`);
  const r3 = await api(S.bruno.page, 'DELETE', `/employees/${carlaEmp.id}`);
  check('usuário comum não apaga férias de outro (403)', r3.status === 403, `${r3.status}`);
  check('dados da Carla intactos', emp(A.carla.email).parcels.length >= 1);
});

console.log('\nerros de console:', Object.fromEntries(Object.entries(S).map(([k, s]) => [k, s.page.__errors])));
console.log('diálogos:', Object.fromEntries(Object.entries(S).map(([k, s]) => [k, s.page.__dialogs])));
saveResults(`${QA}/r2.json`);
await browser.close();
