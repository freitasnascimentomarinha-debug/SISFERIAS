// Utilitários dos testes de navegador (e2e) do SISFERIAS.
// Executados por tests/e2e/run.mjs, que sobe um servidor isolado e informa
// o endereço (E2E_BASE) e a pasta de trabalho (E2E_DIR).
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

process.removeAllListeners('warning');
const { DatabaseSync } = await import('node:sqlite');

/** Usa o Playwright do projeto ou, se não houver, o instalado globalmente. */
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* tenta o global */ }
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return createRequire(path.join(globalRoot, '/'))('playwright');
  } catch {
    console.error('Playwright não encontrado. Instale com: npm install --no-save playwright && npx playwright install chromium');
    process.exit(2);
  }
}
const pw = await loadPlaywright();
export const chromium = pw.chromium || pw.default?.chromium;

export const BASE = process.env.E2E_BASE || 'http://localhost:3999';
export const QA = process.env.E2E_DIR || path.resolve('e2e-resultados');
export const DB_FILE = path.join(QA, 'data', 'sisferias.db');
export const SHOTS = path.join(QA, 'capturas');
fs.mkdirSync(SHOTS, { recursive: true });

export const results = [];
let section = '';
export const setSection = (s) => { section = s; console.log(`\n### ${s}`); };

export function check(name, ok, detail = '') {
  results.push({ section, name, ok: !!ok, detail: String(detail ?? '') });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

export async function step(name, fn) {
  try { await fn(); } catch (e) {
    check(name, false, 'EXCEÇÃO: ' + (e.message || e).toString().split('\n')[0].slice(0, 300));
  }
}

export function db(sql, ...params) {
  const d = new DatabaseSync(DB_FILE, { readOnly: true });
  try { return d.prepare(sql).all(...params); } finally { d.close(); }
}

export async function newSession(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  page.__errors = [];
  page.__dialogs = [];
  page.on('pageerror', e => page.__errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') page.__errors.push(m.text()); });
  page.on('dialog', d => { page.__dialogs.push(d.message()); d.accept(); });
  page.__label = label;
  return { ctx, page };
}

export async function login(page, loginId, password) {
  await page.goto(BASE);
  await page.waitForSelector('text=Entrar');
  await page.fill('input[type=text]', loginId);
  await page.fill('input[type=password]', password);
  await page.click('button[type=submit]');
  await page.waitForTimeout(1300);
  return !(await page.isVisible('text=Acesse sua conta'));
}

export async function api(page, method, path, body) {
  return page.evaluate(async ({ method, path, body }) => {
    const r = await fetch('/api' + path, {
      method,
      headers: { 'X-Requested-With': 'sisferias', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null; try { data = await r.json(); } catch {}
    return { status: r.status, data };
  }, { method, path, body });
}

export async function nav(page, label) {
  await page.click(`header >> text=${label}`);
  await page.waitForTimeout(900);
}

export async function unlockSecurity(page, password) {
  await nav(page, 'Segurança');
  if (await page.isVisible('text=sua senha de login')) {
    await page.fill('input[type=password]', password);
    await page.click('button:has-text("Acessar")');
    await page.waitForTimeout(900);
  }
  return page.isVisible('text=Bloquear área');
}

export async function tab(page, label) {
  await page.click(`button:has-text("${label}")`);
  await page.waitForTimeout(700);
}

export async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

export function saveResults(file) {
  fs.writeFileSync(file, JSON.stringify(results, null, 2));
  const fail = results.filter(r => !r.ok);
  console.log(`\nTOTAL: ${results.length}  PASS: ${results.length - fail.length}  FAIL: ${fail.length}`);
}
