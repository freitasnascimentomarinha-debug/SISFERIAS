// Etapa 7: troca de senha pelo usuário, regra de senha, ajustes de tela e cópia dos backups.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { chromium, check, step, setSection, db, newSession, login, api, nav, unlockSecurity, tab, shot, saveResults, QA, BASE } from './lib.mjs';

const browser = await chromium.launch();
const ADMIN = { login: 'admin', pass: 'Admin@45678' };
const { page: P } = await newSession(browser, 'admin'); await login(P, ADMIN.login, ADMIN.pass);
const { page: B } = await newSession(browser, 'bruno'); await login(B, '20000002', 'Bruno@12345');

setSection('Item 1 — usuário troca a própria senha');
await step('troca de senha pelo menu', async () => {
  await B.click('button[title="Alterar minha senha"]');
  const pw = B.locator('.fixed input[type=password]');
  await pw.nth(0).fill('errada'); await pw.nth(1).fill('Bruno@78901'); await pw.nth(2).fill('Bruno@78901');
  await B.click('.fixed button[type=submit]'); await B.waitForTimeout(800);
  check('senha atual errada é recusada', await B.isVisible('text=Senha atual incorreta'));
  await pw.nth(0).fill('Bruno@12345'); await pw.nth(1).fill('12345'); await pw.nth(2).fill('12345');
  await B.click('.fixed button[type=submit]'); await B.waitForTimeout(500);
  check('senha nova fora da regra é recusada (DCTIM: 10+, maiúscula, minúscula, número, especial)', await B.isVisible('text=pelo menos 10 caracteres'));
  await pw.nth(1).fill('Bruno@78901'); await pw.nth(2).fill('Bruno@78901');
  await B.click('.fixed button[type=submit]'); await B.waitForTimeout(1000);
  check('troca concluída com sucesso', await B.isVisible('text=Senha alterada com sucesso'));
  const { page: t } = await newSession(browser, 'bruno-nova');
  check('entra com a nova senha', await login(t, '20000002', 'Bruno@78901'));
  const { page: t2 } = await newSession(browser, 'bruno-velha');
  check('senha antiga deixa de funcionar', !(await login(t2, '20000002', 'Bruno@12345')));
  // volta a senha original para as próximas execuções
  await api(t, 'POST', '/auth/password', { current_password: 'Bruno@78901', password: 'Bruno@12345' });
  await shot(B, 't7-alterar-senha');
});

setSection('Item 6 — regra única de senha');
await step('cadastro e redefinição seguem a regra de senha da DCTIM', async () => {
  const { page: r } = await newSession(browser, 'cadastro');
  await r.goto(BASE); await r.click('text=Cadastre-se');
  await r.fill('input[placeholder="Seu nome completo"]', 'Gabi Teste');
  await r.fill('input[placeholder="Nome de guerra"]', 'GABI');
  await r.fill('input[placeholder="Número de Identificação Pessoal"]', '70000007');
  await r.fill('input[placeholder="seu@email.com"]', 'gabi@mb.mil.br');
  const pw = r.locator('input[placeholder="********"]');
  await pw.nth(0).fill('12345'); await pw.nth(1).fill('12345');
  await r.click('button[type=submit]'); await r.waitForTimeout(800);
  check('cadastro com senha fraca é recusado', await r.isVisible('text=pelo menos 10 caracteres') && !db("SELECT 1 FROM profiles WHERE email = 'gabi@mb.mil.br'").length);
  check('a tela mostra o checklist da regra de senha', await r.isVisible('[data-testid=regras-senha]'));
  const res = await api(P, 'POST', '/admin/reset-password', { email: 'carla@mb.mil.br', password: '1234' });
  check('servidor recusa redefinição com senha curta', res.status === 400 || res.status === 403);
});

setSection('Item 9 — ajustes de tela');
await step('clicar de novo em "Minhas Férias" volta para a 1ª etapa', async () => {
  await nav(B, 'Início'); await nav(B, 'Minhas Férias'); await B.waitForTimeout(600);
  await B.click('button:has-text("Próximo")'); await B.waitForTimeout(300);
  const onStep2 = !(await B.isVisible('text=Dividir em quantas parcelas'));
  await nav(B, 'Minhas Férias'); await B.waitForTimeout(600);
  check('volta para a 1ª etapa ao clicar de novo no menu', onStep2 && await B.isVisible('text=Dividir em quantas parcelas'));
});
await step('nome da instituição gravado uma vez, ao parar de digitar', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Sistema');
  const puts = [];
  P.on('request', r => { if (r.method() === 'PUT' && r.url().endsWith('/api/settings')) puts.push(r.url()); });
  const input = P.locator('label:has-text("Nome Institucional") + input');
  await input.fill('');
  await input.pressSequentially('COPAB TESTE', { delay: 40 });
  await P.waitForTimeout(1500);
  const saved = db('SELECT institution_name n FROM system_settings')[0].n;
  check('valor final gravado', saved === 'COPAB TESTE', saved);
  check('gravado poucas vezes (não a cada letra)', puts.length <= 2, `${puts.length} gravação(ões) para 11 letras`);
  await input.fill('CENTRO DE OPERAÇÕES DO ABASTECIMENTO'); await input.blur(); await P.waitForTimeout(1200);
});

setSection('Item 2 — cópia dos backups para outra pasta');
await step('configurar pasta extra pela tela', async () => {
  const extra = fs.mkdtempSync(path.join(os.tmpdir(), 'sisferias-copia-e2e-'));
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Dados e Backup');
  await P.fill('input[placeholder^="Ex.:"]', extra);
  await P.click('button:has-text("Salvar e testar")'); await P.waitForTimeout(1500);
  check('pasta configurada com mensagem de confirmação', await P.isVisible('text=Pasta configurada'));
  check('cópia de teste gravada na pasta', fs.readdirSync(extra).some(f => f.endsWith('.json')));
  check('tela mostra a última cópia', await P.isVisible('text=Última cópia'));
  await P.click('button:has-text("Criar backup agora")'); await P.waitForTimeout(1200);
  check('backups seguintes também são copiados', fs.readdirSync(extra).filter(f => f.endsWith('.json')).length >= 2);
  // pasta "dentro" de um arquivo comum: inválida em qualquer sistema
  const fileNotDir = path.join(extra, 'arquivo.txt'); fs.writeFileSync(fileNotDir, 'x');
  const bad = await api(P, 'PUT', '/admin/backup-copy', { dir: path.join(fileNotDir, 'sub') });
  check('pasta sem permissão de gravação é recusada com mensagem', bad.status === 400, bad.data?.error);
  await shot(P, 't7-copia-backup');
  await P.click('button:has-text("Desativar")'); await P.waitForTimeout(800);
  check('cópia extra desativada', !db('SELECT backup_copy_dir d FROM system_settings')[0].d);
});

saveResults(`${QA}/r7.json`);
await browser.close();
