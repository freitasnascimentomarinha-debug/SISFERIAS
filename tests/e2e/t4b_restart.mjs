// Parte 4b: depois de reiniciar o servidor.
import fs from 'fs';
import { chromium, check, step, setSection, db, newSession, login, api, nav, saveResults, QA } from './lib.mjs';
import { BASE } from './lib.mjs';

const browser = await chromium.launch();
const before = JSON.parse(fs.readFileSync(`${QA}/snapshot.json`, 'utf8'));

setSection('19. Persistência após reiniciar o servidor');
const now = {
  profiles: db('SELECT id, email, role, is_blocked, view_all_sectors, nip FROM profiles ORDER BY id'),
  employees: db('SELECT id, user_id, planning_year, vacation_parcels, justification, photo_url IS NOT NULL foto FROM employees ORDER BY id'),
  settings: db('SELECT institution_name, total_manpower, staff_json, logo_url IS NOT NULL logo FROM system_settings'),
  prefs: db('SELECT user_id, phone, address FROM print_preferences ORDER BY user_id'),
  notices: db('SELECT COUNT(*) c FROM notices')[0].c,
  suggestions: db('SELECT COUNT(*) c FROM suggestions')[0].c,
  audit: db('SELECT COUNT(*) c FROM audit_logs')[0].c,
};
for (const k of Object.keys(before)) {
  const same = JSON.stringify(before[k]) === JSON.stringify(now[k]);
  check(`dados preservados: ${k}`, same, same ? '' : 'diferente após reiniciar');
}
check('servidor não recriou admin inicial (já existe admin)', !fs.readFileSync(process.env.E2E_SERVER_LOG, 'utf8').includes('acesso inicial'));

await step('sessão continua válida após reiniciar', async () => {
  const ctx = await browser.newContext({ storageState: `${QA}/bruno-state.json` });
  const p = await ctx.newPage(); await p.goto(BASE); await p.waitForTimeout(1500);
  check('usuário continua logado após reiniciar o servidor', await p.isVisible('header >> text=Minhas Férias'));
  await nav(p, 'Início'); await nav(p, 'Minhas Férias'); await p.waitForTimeout(800);
  const d = await p.locator('form input[type=date]').evaluateAll(els => els.map(e => e.value));
  check('formulário do Bruno mostra as férias após reiniciar', d.includes('2026-01-05'), d.join(','));
  await ctx.close();
});
await step('login e senhas após reiniciar', async () => {
  const { page } = await newSession(browser, 'admin');
  check('admin entra com a senha alterada após reiniciar', await login(page, 'admin', 'Admin@456'));
  const { page: c } = await newSession(browser, 'carla');
  check('Carla entra após reiniciar', await login(c, '30000003', 'Carla@123'));
});

saveResults(`${QA}/r4b.json`);
await browser.close();
