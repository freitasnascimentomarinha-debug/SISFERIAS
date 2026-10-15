// Etapa 10: acessibilidade (e-MAG / WCAG 2.1 níveis A e AA) verificada com o
// axe-core em todas as telas, para usuário comum e administrador.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium, check, step, setSection, newSession, login, nav, unlockSecurity, tab, saveResults, QA, BASE } from './lib.mjs';

const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const ADMIN = { login: 'admin', pass: 'Admin@45678' };
const CARLA = { nip: '30000003', pass: 'Carla@12345' }; // conta criada na etapa 1

async function audit(page, tela) {
  await page.waitForTimeout(800);
  await page.evaluate(AXE);
  const r = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
  const detail = r.violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`).join(' | ');
  check(`${tela}: sem violações de acessibilidade`, r.violations.length === 0, detail);
}

const browser = await chromium.launch();

setSection('e-MAG / WCAG 2.1 AA — telas públicas');
await step('login, aviso de privacidade e cadastro', async () => {
  const { page } = await newSession(browser, 'a11y-anon');
  await page.goto(BASE); await page.waitForSelector('text=Entrar');
  await audit(page, 'Login');
  await page.click('text=Aviso de Privacidade (LGPD)'); await page.waitForSelector('[role=dialog][data-loaded=true]');
  await audit(page, 'Aviso de Privacidade');
  await page.click('[role=dialog] button:has-text("Fechar")');
  await page.click('text=Cadastre-se');
  await audit(page, 'Cadastro');
});

setSection('e-MAG / WCAG 2.1 AA — usuário');
await step('telas do usuário comum', async () => {
  const { page } = await newSession(browser, 'a11y-carla');
  await login(page, CARLA.nip, CARLA.pass);
  await audit(page, 'Início');
  await nav(page, 'Minhas Férias'); await audit(page, 'Minhas Férias');
  await nav(page, 'Impressão'); await audit(page, 'Impressão');
});

setSection('e-MAG / WCAG 2.1 AA — administração');
await step('telas do administrador', async () => {
  const { page } = await newSession(browser, 'a11y-admin');
  await login(page, ADMIN.login, ADMIN.pass);
  await nav(page, 'Painel'); await audit(page, 'Painel');
  await page.click('button:has-text("Diagnóstico")'); await audit(page, 'Diagnóstico');
  await page.keyboard.press('Escape'); await page.goto(BASE); await page.waitForTimeout(1200);
  await nav(page, 'Calendário'); await audit(page, 'Calendário');
  await nav(page, 'Justificativas'); await audit(page, 'Justificativas');
  await nav(page, 'Trâmite'); await audit(page, 'Trâmite');
  await unlockSecurity(page, ADMIN.pass);
  for (const t of ['Gestão de Contas', 'Visibilidade', 'Usuários', 'Sugestões', 'Sistema', 'Auditoria Detalhada', 'Registro de Operações', 'Dados e Backup']) {
    await tab(page, t); await audit(page, `Segurança › ${t}`);
  }
});

saveResults(`${QA}/r10.json`);
await browser.close();
