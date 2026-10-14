// Parte 4a: concorrência, uploads e retrato do banco antes de reiniciar.
import fs from 'fs';
import { chromium, check, step, setSection, db, newSession, login, api, nav, unlockSecurity, tab, saveResults, QA } from './lib.mjs';

const browser = await chromium.launch();
const ADMIN = { login: 'admin', pass: 'Admin@456' };
const users = [
  { nip: '20000002', pass: 'Bruno@123', email: 'bruno@mb.mil.br' },
  { nip: '30000003', pass: 'Carla@123', email: 'carla@mb.mil.br' },
  { nip: '10000001', pass: 'Ana@1234', email: 'ana@mb.mil.br' },
];
const S = { admin: await newSession(browser, 'admin') };
await login(S.admin.page, ADMIN.login, ADMIN.pass);
for (const u of users) { S[u.email] = await newSession(browser, u.email); await login(S[u.email].page, u.nip, u.pass); }

setSection('16. Gravações simultâneas');
await step('4 usuários salvam ao mesmo tempo', async () => {
  const jobs = users.map(async (u, i) => {
    const p = S[u.email].page;
    const me = (await api(p, 'GET', '/auth/me')).data.user;
    const r = [];
    for (let k = 0; k < 10; k++) {
      r.push(await api(p, 'POST', '/employees', {
        user_id: me.id, planning_year: 2027, name: me.name, war_name: me.war_name, sector: me.sector,
        total_vacation_days: 30, vacation_parcels: [{ id: `c${k}`, startDate: '2028-01-01', endDate: '2028-01-10', days: 10 }],
        justification: `concorrente ${k}`,
      }));
    }
    return r;
  });
  const adminJob = (async () => {
    await unlockSecurity(S.admin.page, ADMIN.pass);
    const r = [];
    for (let k = 0; k < 10; k++) r.push(await api(S.admin.page, 'POST', '/audit-logs', { user_name: 'QA', action: 'Alteração', field: `concorrência ${k}`, old_value: '-', new_value: '-' }));
    return r;
  })();
  const all = (await Promise.all([...jobs, adminJob])).flat();
  const bad = all.filter(r => r.status >= 300);
  check('40 gravações simultâneas sem erro', bad.length === 0, bad.length ? JSON.stringify(bad[0]) : `${all.length} requisições OK`);
  const n = db('SELECT COUNT(*) c FROM employees WHERE planning_year = 2027')[0].c;
  check('cada usuário ficou com exatamente 1 lançamento de 2027 (sem duplicar)', n === 3, `${n} registros`);
  const last = db("SELECT justification j FROM employees WHERE planning_year = 2027").map(r => r.j);
  check('a última gravação de cada usuário prevaleceu', last.every(j => j === 'concorrente 9'), last.join(', '));
});

setSection('17. Imagens (foto e logo)');
const png = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
await step('logo da instituição', async () => {
  const r = await api(S.admin.page, 'PUT', '/settings', { logo_url: png, total_manpower: 250 });
  const s = db('SELECT logo_url, total_manpower FROM system_settings WHERE id = 1')[0];
  check('logo (imagem) e efetivo gravados', r.status === 200 && s.logo_url === png && s.total_manpower === 250);
  const p = S['bruno@mb.mil.br'].page; await p.reload(); await p.waitForTimeout(1200);
  check('usuário vê o logo no Início', await p.locator(`img[src^="data:image/png"]`).count() > 0);
});
await step('foto do militar', async () => {
  const p = S['bruno@mb.mil.br'].page;
  const me = (await api(p, 'GET', '/auth/me')).data.user;
  const e = db('SELECT id FROM employees WHERE user_id = ? AND planning_year = 2025', me.id)[0];
  const r = await api(p, 'PATCH', `/employees/${e.id}`, { photo_url: png });
  check('foto do militar gravada', r.status === 200 && db('SELECT photo_url FROM employees WHERE id = ?', e.id)[0].photo_url === png);
});

setSection('18. Retrato antes de reiniciar');
const snapshot = {
  profiles: db('SELECT id, email, role, is_blocked, view_all_sectors, nip FROM profiles ORDER BY id'),
  employees: db('SELECT id, user_id, planning_year, vacation_parcels, justification, photo_url IS NOT NULL foto FROM employees ORDER BY id'),
  settings: db('SELECT institution_name, total_manpower, staff_json, logo_url IS NOT NULL logo FROM system_settings'),
  prefs: db('SELECT user_id, phone, address FROM print_preferences ORDER BY user_id'),
  notices: db('SELECT COUNT(*) c FROM notices')[0].c,
  suggestions: db('SELECT COUNT(*) c FROM suggestions')[0].c,
  audit: db('SELECT COUNT(*) c FROM audit_logs')[0].c,
};
fs.writeFileSync(`${QA}/snapshot.json`, JSON.stringify(snapshot));
await S['bruno@mb.mil.br'].ctx.storageState({ path: `${QA}/bruno-state.json` });
check('retrato do banco salvo para comparação', true, `${snapshot.profiles.length} perfis, ${snapshot.employees.length} lançamentos, ${snapshot.audit} auditorias`);

saveResults(`${QA}/r4a.json`);
await browser.close();
