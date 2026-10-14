// Etapa 8: relatório Excel, redução de foto/logo, aba "tracking" removida e HTTPS.
import fs from 'fs';
import path from 'path';
import { unzipSync, strFromU8 } from 'fflate';
import { chromium, check, step, setSection, db, newSession, login, nav, unlockSecurity, tab, shot, saveResults, QA, BASE } from './lib.mjs';
import { startServer } from '../helpers.mjs';

const browser = await chromium.launch();
const ADMIN = { login: 'admin', pass: 'Admin@456' };
const { ctx, page: P } = await newSession(browser, 'admin'); await login(P, ADMIN.login, ADMIN.pass);

/** Gera no navegador uma imagem grande (como foto de celular) e devolve o arquivo. */
async function bigImage(page, { width, height, type }) {
  const b64 = await page.evaluate(async ({ width, height, type }) => {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const g = c.getContext('2d');
    for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${i % 360},70%,50%)`; g.fillRect(Math.random() * width, Math.random() * height, 300, 300); }
    if (type === 'image/png') g.clearRect(0, 0, 200, 200); // canto transparente
    const blob = await new Promise(r => c.toBlob(r, type, 1));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (const x of buf) s += String.fromCharCode(x);
    return btoa(s);
  }, { width, height, type });
  return { name: type === 'image/png' ? 'logo.png' : 'foto.jpg', mimeType: type, buffer: Buffer.from(b64, 'base64') };
}
const dataUrlInfo = async (page, url) => page.evaluate(u => new Promise(res => {
  const img = new Image(); img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight }); img.src = u;
}), url);

setSection('Item 8 — relatório Excel do Painel');
await step('exportar Excel', async () => {
  await nav(P, 'Painel'); await P.waitForTimeout(1200);
  const dl = P.waitForEvent('download', { timeout: 15000 });
  await P.click('button:has-text("Exportar Excel")');
  const d = await dl;
  const file = path.join(QA, 'relatorio.xlsx'); await d.saveAs(file);
  check('arquivo .xlsx baixado', d.suggestedFilename().endsWith('.xlsx'), d.suggestedFilename());
  const zip = unzipSync(new Uint8Array(fs.readFileSync(file)));
  const workbook = strFromU8(zip['xl/workbook.xml']);
  const sheets = [...workbook.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map(m => m[1]);
  check('5 abas: Informações, Resumo por setor, Militares, Parcelas, Por mês',
    ['Informações', 'Resumo por setor', 'Militares', 'Parcelas', 'Por mês'].every(n => sheets.includes(n)), sheets.join(', '));
  const all = Object.entries(zip).filter(([n]) => n.endsWith('.xml')).map(([, v]) => strFromU8(v)).join('\n');
  const visible = db('SELECT COUNT(*) c FROM employees WHERE planning_year = 2025')[0].c;
  check('militares do Painel estão no relatório', ['BRUNO', 'CARLA'].every(n => all.includes(n)), `${visible} lançamento(s) da janela`);
  check('linha de TOTAL no resumo por setor', all.includes('TOTAL'));
  check('NUP das parcelas no relatório', all.includes('62012.000888/2026-22') || all.includes('62012.000999'));
});

setSection('Item 7 — foto e logo reduzidos automaticamente');
await step('foto grande de celular é reduzida', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Usuários');
  await P.locator('tr', { hasText: 'Carla Dias' }).locator('button[title="Editar Férias"]').click();
  await P.waitForTimeout(1500);
  const photo = await bigImage(P, { width: 4000, height: 3000, type: 'image/jpeg' });
  await P.setInputFiles('form input[type=file]', photo);
  await P.waitForTimeout(1500);
  await P.click('button:has-text("Próximo")'); await P.waitForTimeout(300);
  await P.click('button[type=submit]:has-text("Salvar")'); await P.waitForTimeout(1800);
  const saved = db("SELECT photo_url FROM employees WHERE name = 'Carla Dias' AND planning_year = 2025")[0]?.photo_url || '';
  const dims = saved ? await dataUrlInfo(P, saved) : null;
  check('foto de 4000×3000 enviada', photo.buffer.length > 300_000, `${Math.round(photo.buffer.length / 1024)} KB original`);
  check('foto gravada reduzida (máx. 400 px)', dims && Math.max(dims.w, dims.h) <= 400, dims ? `${dims.w}×${dims.h}, ${Math.round(saved.length * 0.75 / 1024)} KB` : 'não gravada');
});
await step('logo é reduzido mantendo transparência', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Sistema');
  const logo = await bigImage(P, { width: 2400, height: 2400, type: 'image/png' });
  await P.setInputFiles('input[type=file][accept="image/*"]', logo);
  await P.waitForTimeout(2000);
  const saved = db('SELECT logo_url FROM system_settings')[0].logo_url || '';
  const dims = saved ? await dataUrlInfo(P, saved) : null;
  check('logo gravado reduzido (máx. 600 px)', dims && Math.max(dims.w, dims.h) <= 600, dims ? `${dims.w}×${dims.h}` : 'não gravado');
  check('logo continua PNG (mantém transparência)', saved.startsWith('data:image/png'));
});

setSection('Item 10 — aba "tracking" removida');
await step('abas da Segurança', async () => {
  await unlockSecurity(P, ADMIN.pass);
  const tabs = await P.locator('button').allTextContents();
  check('aba de acompanhamento duplicada não aparece mais', !tabs.some(t => /tracking|Acompanhamento NUP/i.test(t)));
  check('Trâmite continua disponível no menu', (await P.textContent('header')).includes('Trâmite'));
});

setSection('Item 11 — carregamento das telas sob demanda');
await step('telas abrem normalmente', async () => {
  for (const item of ['Início', 'Painel', 'Calendário', 'Justificativas', 'Trâmite', 'Minhas Férias', 'Impressão']) {
    await nav(P, item); await P.waitForTimeout(500);
  }
  check('todas as telas abriram sem erro', P.__errors.filter(e => !/40[13]/.test(e)).length === 0, P.__errors.join(' | '));
});

setSection('Item 5 — HTTPS');
await step('sistema completo em HTTPS', async () => {
  const dataDir = path.join(QA, 'https-data');
  const srv = await startServer({ dataDir, env: { HTTPS: '1', ADMIN_PASSWORD: 'Https@123' } });
  try {
    const hctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
    const hp = await hctx.newPage();
    hp.__errors = []; hp.on('pageerror', e => hp.__errors.push(e.message));
    hp.on('dialog', d => d.accept());
    await hp.goto(srv.base); await hp.waitForSelector('text=Entrar');
    await hp.fill('input[type=text]', 'admin'); await hp.fill('input[type=password]', 'Https@123');
    await hp.click('button[type=submit]'); await hp.waitForTimeout(1500);
    check('login funciona em HTTPS (cookie seguro)', await hp.isVisible('header >> text=Segurança'));
    const cookies = await hctx.cookies();
    check('cookie de sessão marcado como Secure', cookies.some(c => c.name === 'sisferias_session' && c.secure));
    await hp.click('header >> text=Minhas Férias'); await hp.waitForTimeout(1000);
    const d = hp.locator('form input[type=date]');
    await d.nth(0).fill('2026-04-06'); await d.nth(1).fill('2026-04-15');
    await hp.click('button:has-text("Próximo")'); await hp.waitForTimeout(300);
    await hp.click('button[type=submit]:has-text("Salvar")'); await hp.waitForTimeout(1500);
    await hp.click('header >> text=Impressão'); await hp.waitForTimeout(1500);
    await hp.fill('input[placeholder="Ex: 62012.000123/2026-91"]', '62012.000555/2026-55');
    const pp = hp.waitForEvent('popup', { timeout: 8000 });
    await hp.click('button:has-text("Imprimir Documento")');
    const popup = await pp; await popup.waitForTimeout(1500);
    const display = await popup.evaluate(() => getComputedStyle(document.querySelector('.column .flex')).display);
    check('papeleta formatada em HTTPS', display === 'flex', `display = ${display}`);
    await popup.close();
    await shot(hp, 't8-https');
    await hctx.close();
  } finally {
    await srv.stop();
  }
});

saveResults(`${QA}/r8.json`);
await browser.close();
