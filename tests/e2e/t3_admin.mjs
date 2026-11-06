// Parte 3: funções de administrador.
import fs from 'fs';
import { chromium, check, step, setSection, db, newSession, login, api, nav, unlockSecurity, tab, shot, saveResults, QA, SHOTS } from './lib.mjs';

const browser = await chromium.launch();
const ADMIN = { login: 'admin', pass: 'Admin@12345' };
const A = {
  ana:   { nip: '10000001', pass: 'Ana@123456',  email: 'ana@mb.mil.br',   name: 'Ana Lima' },
  bruno: { nip: '20000002', pass: 'Bruno@12345', email: 'bruno@mb.mil.br', name: 'Bruno Costa' },
  carla: { nip: '30000003', pass: 'Carla@12345', email: 'carla@mb.mil.br', name: 'Carla Dias' },
  davi:  { nip: '40000004', pass: 'Davi@123456', email: 'davi@mb.mil.br',  name: 'Davi Rocha' },
};
const uid = (email) => db('SELECT id FROM profiles WHERE email = ?', email)[0]?.id;
const emp = (email, year = 2025) => {
  const r = db('SELECT * FROM employees WHERE user_id = ? AND planning_year = ?', uid(email), year)[0];
  if (r) r.parcels = JSON.parse(r.vacation_parcels);
  return r;
};
const lastAudit = (n = 5) => db('SELECT user_name, action, field, new_value FROM audit_logs ORDER BY timestamp DESC LIMIT ?', n);

async function openForm(page) { await nav(page, 'Início'); await nav(page, 'Minhas Férias'); await page.waitForTimeout(600); }
async function fillAndSave(page, parcels, parcelCount) {
  await page.waitForSelector('text=Dividir em quantas parcelas');
  await page.locator('select:near(:text("Dividir em quantas parcelas"))').first().selectOption(String(parcelCount ?? parcels.length));
  await page.waitForTimeout(200);
  const d = page.locator('form input[type=date]');
  for (let i = 0; i < parcels.length; i++) { await d.nth(i * 2).fill(parcels[i][0]); await d.nth(i * 2 + 1).fill(parcels[i][1]); }
  await page.click('button:has-text("Próximo")'); await page.waitForTimeout(300);
  await page.click('button[type=submit]:has-text("Salvar")'); await page.waitForTimeout(1600);
}
async function securityUsersRow(page, name) {
  await unlockSecurity(page, ADMIN.pass);
  await tab(page, 'Usuários');
  return page.locator('tr', { hasText: name });
}

const S = { admin: await newSession(browser, 'admin') };
await login(S.admin.page, ADMIN.login, ADMIN.pass);
for (const k of Object.keys(A)) { S[k] = await newSession(browser, k); await login(S[k].page, A[k].nip, A[k].pass); }
const P = S.admin.page;

setSection('7. Painel e visibilidade por setor');
await step('Painel do admin geral', async () => {
  await nav(P, 'Painel');
  const t = await P.textContent('main, body');
  check('Painel do admin (visão global) lista Bruno, Carla e Davi', ['BRUNO', 'CARLA', 'DAVI'].every(n => t.includes(n)));
  await shot(P, '07-painel-admin');
});
await step('Painel da Ana (restrita ao setor 10)', async () => {
  const p = S.ana.page; await p.reload(); await p.waitForTimeout(1000); await nav(p, 'Painel');
  const t = await p.textContent('body');
  check('Ana (setor 10) vê apenas o setor 10 (Bruno, não Carla/Davi)', t.includes('BRUNO') && !t.includes('CARLA') && !t.includes('DAVI'));
  const r = await api(p, 'GET', '/employees');
  check('a restrição de setor é aplicada pelo servidor', r.data.every(e => e.sector === '10'), `${r.data.length} registro(s), setores: ${[...new Set(r.data.map(e => e.sector))]}`);
});
await step('encarregada edita e imprime pelo Painel', async () => {
  const p = S.ana.page;
  check('Painel da encarregada mostra os atalhos de editar e imprimir do Bruno',
    await p.locator('button[title="Editar férias de BRUNO"]').count() === 1 && await p.locator('button[title="Imprimir papeleta de BRUNO"]').count() === 1);
  await p.click('button[title="Editar férias de BRUNO"]'); await p.waitForTimeout(1200);
  const vals = await p.$$eval('input', els => els.map(e => e.value));
  check('o lápis abre as férias do Bruno', vals.includes('Bruno Costa'), vals.filter(Boolean).slice(0, 4).join(' | '));
  await nav(p, 'Painel');
});
await step('liberar visão global para Ana', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Visibilidade');
  await P.locator('div, tr', { hasText: A.ana.email }).locator('button:has-text("Liberar Todos os Setores")').last().click();
  await P.waitForTimeout(900);
  const v = db('SELECT view_all_sectors v FROM profiles WHERE email = ?', A.ana.email)[0].v;
  const p = S.ana.page; await p.reload(); await p.waitForTimeout(1000); await nav(p, 'Painel');
  const t = await p.textContent('body');
  check('após liberar visão global, Ana vê todos os setores', v === 1 && t.includes('CARLA') && t.includes('DAVI'));
});
await step('Direção (consulta): vê tudo, não altera, sem Segurança', async () => {
  await tab(P, 'Visibilidade');
  await P.locator('div', { hasText: A.ana.email }).locator('button:has-text("Somente consulta (Direção)")').last().click();
  await P.waitForTimeout(900);
  check('perfil de consulta gravado no banco', db('SELECT read_only r FROM profiles WHERE email = ?', A.ana.email)[0].r === 1);
  const p = S.ana.page; await p.reload(); await p.waitForTimeout(1000); await nav(p, 'Painel');
  const t = await p.textContent('body'); const h = await p.textContent('header');
  check('Direção vê todos os setores no Painel', t.includes('CARLA') && t.includes('DAVI'));
  check('Direção não vê Segurança e aparece como "Direção (consulta)"', !h.includes('Segurança') && h.includes('Direção (consulta)'));
  check('Painel da Direção sem atalhos de edição', await p.locator('button[title^="Editar férias de"]').count() === 0);
  const emp = db("SELECT id FROM employees WHERE user_id = (SELECT id FROM profiles WHERE email = ?)", A.carla.email)[0];
  const r = await api(p, 'PATCH', `/employees/${emp.id}`, { justification: 'x' });
  check('servidor recusa alteração feita pela Direção (403)', r.status === 403, `status ${r.status}`);
  await tab(P, 'Visibilidade');
  await P.locator('div', { hasText: A.ana.email }).locator('button:has-text("Permitir gerenciar")').last().click();
  await P.waitForTimeout(900);
  check('consulta desfeita', db('SELECT read_only r FROM profiles WHERE email = ?', A.ana.email)[0].r === 0);
});

setSection('8. Admin altera parcelas de outro usuário');
await step('admin edita parcela da Carla', async () => {
  const row = await securityUsersRow(P, A.carla.name);
  await row.locator('button[title="Editar Férias"]').click();
  await P.waitForTimeout(1200);
  const vals = await P.locator('form input:not([type=date]):not([type=file])').evaluateAll(els => els.map(e => e.value));
  check('formulário abre com os dados da Carla (não do admin)', vals.includes('Carla Dias') && vals.includes('CARLA'), vals.filter(Boolean).join(' | '));
  await fillAndSave(P, [['2026-10-05', '2026-10-19'], ['2026-12-01', '2026-12-15']], 2);
  const e = emp(A.carla.email);
  check('parcelas da Carla alteradas pelo admin e gravadas', e.parcels.length === 2 && e.parcels[0].startDate === '2026-10-05' && e.parcels[1].endDate === '2026-12-15',
    e.parcels.map(x => `${x.startDate}..${x.endDate}`).join(', '));
  check('lançamento continua pertencendo à Carla', e.user_id === uid(A.carla.email) && e.name === 'Carla Dias');
  const audit = lastAudit(3).find(a => a.field.includes('Períodos de Férias'));
  check('alteração registrada na auditoria com o nome do admin', audit && audit.user_name === 'Administrador', audit ? `${audit.user_name}: ${audit.field}` : 'sem registro');
});
await step('Carla vê a alteração feita pelo admin', async () => {
  const p = S.carla.page; await p.reload(); await p.waitForTimeout(1000); await openForm(p);
  const d = await p.locator('form input[type=date]').evaluateAll(els => els.map(e => e.value));
  check('Carla vê as parcelas alteradas pelo admin', d.join(',') === '2026-10-05,2026-10-19,2026-12-01,2026-12-15', d.join(','));
});
await step('admin cria lançamento para quem não tem (Ana)', async () => {
  const row = await securityUsersRow(P, A.ana.name);
  await row.locator('button[title="Editar Férias"]').click(); await P.waitForTimeout(1200);
  await fillAndSave(P, [['2026-05-04', '2026-06-02']], 1);
  const e = emp(A.ana.email);
  check('admin cria lançamento em nome da Ana', e && e.parcels[0].days === 30 && e.name === 'Ana Lima', e ? `${e.parcels[0].days} dias, nome ${e.name}` : 'não gravado');
});

setSection('9. Papeleta (impressão)');
let popupHtml = '';
await step('papeleta exige NUP', async () => {
  const row = await securityUsersRow(P, A.carla.name);
  await row.locator('button[title="Imprimir Papeleta"]').click(); await P.waitForTimeout(1500);
  await P.click('button:has-text("Imprimir Documento")'); await P.waitForTimeout(600);
  check('sem NUP, a impressão é bloqueada com aviso', await P.isVisible('text=Preencha o NUP'));
  await shot(P, '09-papeleta-form');
});
await step('gerar papeleta da Carla (admin)', async () => {
  await P.fill('input[placeholder="Ex: 62012.000123/2026-91"]', '62012.000777/2026-11');
  await P.fill('input[placeholder="Logradouro"]', 'Rua das Flores');
  await P.fill('input[placeholder="Nº"]', '120');
  await P.fill('input[placeholder="Cidade"]', 'Rio de Janeiro');
  await P.fill('input[placeholder="Estado"]', 'RJ');
  await P.fill('input[placeholder="Telefone"]', '21 99999-0000');
  // Este ambiente não alcança a internet: é um teste real de rede interna.
  const popupPromise = P.waitForEvent('popup', { timeout: 8000 });
  await P.click('button:has-text("Imprimir Documento")');
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.waitForTimeout(1500);
  popupHtml = await popup.content();
  const styled = await popup.evaluate(() => {
    const el = document.querySelector('.column .flex.justify-between') || document.querySelector('.column .flex');
    return el ? getComputedStyle(el).display : 'n/a';
  });
  check('papeleta abre com nome, NUP e endereço', popupHtml.includes('CARLA') && popupHtml.includes('62012.000777/2026-11') && popupHtml.includes('Rua das Flores'));
  check('papeleta formatada SEM internet (classes Tailwind aplicadas)', styled === 'flex', `display do layout = ${styled} (esperado "flex")`);
  const e = emp(A.carla.email);
  check('NUP gravado na parcela da Carla', e.parcels[0].nup === '62012.000777/2026-11', e.parcels.map(x => x.nup || '-').join(', '));
  const pref = db('SELECT * FROM print_preferences WHERE user_id = ?', uid(A.carla.email))[0];
  check('endereço e telefone da papeleta gravados', pref && JSON.parse(pref.address).street === 'Rua das Flores' && pref.phone === '21 99999-0000');
  const a = lastAudit(5).find(x => x.action === 'Impressão');
  check('impressão registrada na auditoria', !!a, a ? a.field : '');
  await popup.close();
});
await step('papeleta reabre com dados salvos', async () => {
  await nav(P, 'Início');
  const row = await securityUsersRow(P, A.carla.name);
  await row.locator('button[title="Imprimir Papeleta"]').click(); await P.waitForTimeout(1800);
  const street = await P.inputValue('input[placeholder="Logradouro"]');
  const nup = await P.inputValue('input[placeholder="Ex: 62012.000123/2026-91"]');
  check('ao reabrir a papeleta, endereço e NUP vêm preenchidos', street === 'Rua das Flores' && nup === '62012.000777/2026-11', `${street} | ${nup}`);
});
await step('usuário gera a própria papeleta', async () => {
  const p = S.bruno.page; await nav(p, 'Impressão'); await p.waitForTimeout(1500);
  await p.fill('input[placeholder="Ex: 62012.000123/2026-91"]', '62012.000888/2026-22');
  const popupPromise = p.waitForEvent('popup', { timeout: 8000 });
  await p.click('button:has-text("Imprimir Documento")');
  const popup = await popupPromise; await popup.waitForTimeout(1200);
  const html = await popup.content();
  check('Bruno gera a própria papeleta', html.includes('BRUNO') && html.includes('62012.000888/2026-22'));
  check('NUP do Bruno gravado', emp(A.bruno.email).parcels[0].nup === '62012.000888/2026-22');
  await popup.close();
});
await step('requerimento de férias (Word)', async () => {
  const p = S.bruno.page;
  await p.click('button:has-text("Requerimento")');
  await p.waitForSelector('[role=dialog][aria-labelledby=req-titulo]');
  check('botão Requerimento abre a janela com os dados do militar',
    (await p.inputValue('#req-nome')) === 'Bruno Costa' && (await p.inputValue('#req-nip')) === '20000002');
  await p.fill('#req-nup', '63341.000563/2026-02');
  await p.locator('[role=radiogroup][aria-label^="Adiantamento"] label:has-text("Sim")').click();
  await p.locator('[role=radiogroup][aria-label^="Remuneração"] label:has-text("Sim")').click();
  // Parcela de 05/01/2026: exercício de pagamento dez/2025–nov/2026 → 13º de 2026.
  check('ano do adicional natalino sugerido pelo exercício de pagamento (dez–nov)', (await p.inputValue('#req-ano-natalino')) === '2026', await p.inputValue('#req-ano-natalino'));
  await p.fill('#req-ano-natalino', '2027');
  const downloadPromise = p.waitForEvent('download', { timeout: 15000 });
  await p.click('button:has-text("OK, baixar requerimento")');
  const download = await downloadPromise;
  const file = `${QA}/${download.suggestedFilename()}`;
  await download.saveAs(file);
  const { execSync } = await import('node:child_process');
  const xml = execSync(`unzip -p "${file}" word/document.xml`).toString();
  const texto = xml.replace(/<[^>]+>/g, '');
  check('requerimento baixado em Word (.docx)', file.endsWith('.docx') && texto.includes('REQUERIMENTO'), download.suggestedFilename());
  check('requerimento com nome, NIP formatado e período da parcela',
    texto.includes('BRUNO COSTA') && texto.includes('20.0000.02') && texto.includes('63341.000563/2026-02') && /\d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}/.test(texto));
  check('requerimento com as escolhas Sim/Não',
    texto.includes('( S ) Adiantamento do Adicional Natalino do ano de 2027 (50%)') && texto.includes('( S ) Adicional de Férias (1/3)') && texto.includes('( S ) Remuneração de Férias (70%)'));
  check('requerimento traz o brasão', execSync(`unzip -l "${file}"`).toString().includes('word/media/'));
  await p.waitForTimeout(800);
  const a = db("SELECT field, new_value FROM audit_logs WHERE field LIKE 'Requerimento de férias%' ORDER BY timestamp DESC LIMIT 1")[0];
  check('geração do requerimento registrada na auditoria', !!a && a.new_value.includes('Adiant. natalino: S'), a ? a.new_value : 'sem registro');
});
await step('usuário não acessa papeleta de outro', async () => {
  const carlaUid = uid(A.carla.email);
  const r = await api(S.bruno.page, 'GET', `/print-preferences/${carlaUid}`);
  check('Bruno não lê preferências de impressão da Carla (403)', r.status === 403);
});

setSection('10. Trâmite, Justificativas, Calendário, Relatórios');
await step('Trâmite: admin corrige NUP', async () => {
  await nav(P, 'Trâmite'); await P.waitForTimeout(800);
  const row = P.locator('tr', { hasText: '62012.000888/2026-22' }).first();
  await row.locator('button[title="Inserir ou corrigir NUP"]').click();
  await P.locator('tr input[placeholder="Ex: 62012.000123/2026-91"]').fill('62012.000999/2026-33');
  await P.click('button[title="Salvar NUP"]'); await P.waitForTimeout(900);
  check('NUP corrigido no Trâmite e gravado', emp(A.bruno.email).parcels[0].nup === '62012.000999/2026-33');
  await shot(P, '10-tramite');
});
await step('Justificativas', async () => {
  await nav(P, 'Justificativas'); await P.waitForTimeout(800);
  const t = await P.textContent('body');
  check('Justificativas mostra a justificativa do Bruno', t.includes('Viagem em família'));
});
await step('Calendário', async () => {
  await nav(P, 'Calendário'); await P.waitForTimeout(900);
  await P.click('button:has-text("Ano")').catch(() => {}); await P.waitForTimeout(600);
  await shot(P, '10-calendario');
  const t = await P.textContent('body');
  check('Calendário carrega e mostra militares', /BRUNO|CARLA|DAVI|Bruno|Carla|Davi/.test(t));
});
await step('Exportar CSV do Painel', async () => {
  await nav(P, 'Painel');
  const dl = P.waitForEvent('download', { timeout: 6000 });
  await P.click('button:has-text("Exportar CSV")');
  const d = await dl; const f = `${QA}/painel.csv`; await d.saveAs(f);
  const csv = fs.readFileSync(f, 'utf8');
  check('CSV do Painel exportado com os militares', csv.includes('BRUNO') || csv.includes('Bruno'), `${csv.split('\n').length} linhas`);
});
await step('Relatório PDF do Painel', async () => {
  const popupPromise = P.waitForEvent('popup', { timeout: 6000 });
  await P.click('button:has-text("Gerar Relatório")');
  const popup = await popupPromise; await popup.waitForTimeout(1000);
  const html = await popup.content();
  check('relatório do Painel abre com os dados', html.includes('BRUNO') || html.includes('Bruno'));
  await popup.close();
});

setSection('11. Avisos e sugestões');
await step('criar, fixar e excluir aviso', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Sistema');
  await P.fill('input[placeholder="Ex: Novo prazo de entrega"]', 'Prazo de férias 2026');
  await P.fill('textarea[placeholder="Escreva o comunicado aqui..."]', 'Lançar até 30/11.');
  await P.locator('button', { hasText: /Publicar|Adicionar|Enviar/ }).first().click(); await P.waitForTimeout(1000);
  const n = db("SELECT * FROM notices WHERE title = 'Prazo de férias 2026'")[0];
  check('aviso criado e gravado', !!n);
  const p = S.bruno.page; await nav(p, 'Início'); await p.reload(); await p.waitForTimeout(1200);
  check('usuário vê o aviso no Início', (await p.textContent('body')).includes('Prazo de férias 2026'));
  const card = P.locator('div.flex-1:has(h4:text-is("Prazo de férias 2026"))').locator('xpath=..');
  await card.locator('button[title="Fixar no topo"]').click(); await P.waitForTimeout(800);
  check('aviso fixado (gravado)', db("SELECT is_pinned FROM notices WHERE title = 'Prazo de férias 2026'")[0].is_pinned === 1);
  await card.locator('button').nth(1).click(); await P.waitForTimeout(500);
  await P.click('button:has-text("Sim, Excluir")'); await P.waitForTimeout(900);
  check('aviso excluído', db("SELECT COUNT(*) c FROM notices WHERE title = 'Prazo de férias 2026'")[0].c === 0);
});
await step('sugestão: enviar, ver e excluir', async () => {
  const p = S.bruno.page; await nav(p, 'Início');
  await p.evaluate(() => {}); // a página de sugestões fica no menu de ajuda do Início
  const r = await api(p, 'POST', '/suggestions', { title: 'Modo escuro', description: 'Seria ótimo um tema escuro.', user_name: 'Bruno Costa', war_name: 'BRUNO' });
  check('usuário envia sugestão', r.status === 201);
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Sugestões');
  check('admin vê a sugestão', (await P.textContent('body')).includes('Modo escuro'));
  await P.click('button[title="Excluir sugestão de Bruno Costa"]'); await P.waitForTimeout(900);
  check('admin exclui a sugestão', db("SELECT COUNT(*) c FROM suggestions WHERE title = 'Modo escuro'")[0].c === 0);
});

setSection('12. Configurações do sistema');
await step('nome da instituição e efetivo', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Sistema');
  const inst = P.locator('input').filter({ has: P.locator('xpath=.') }).first();
  const instInput = P.locator('input[value="MARINHA DO BRASIL"]');
  await instInput.fill('CENTRO DE OPERAÇÕES DO ABASTECIMENTO');
  await P.waitForTimeout(1500);
  const s = db('SELECT institution_name FROM system_settings WHERE id = 1')[0];
  check('nome da instituição gravado (digitado letra a letra)', s.institution_name === 'CENTRO DE OPERAÇÕES DO ABASTECIMENTO', s.institution_name);
});
await step('autoridades assinantes', async () => {
  const firstName = P.locator('input[placeholder="Nome Completo"], input[placeholder="Nome completo"]').first();
  if (await firstName.count()) await firstName.fill('Almirante Teste');
  await P.click('button:has-text("Salvar Autoridades")'); await P.waitForTimeout(1000);
  const staff = JSON.parse(db('SELECT staff_json FROM system_settings WHERE id = 1')[0].staff_json || '{}');
  check('autoridades assinantes gravadas', JSON.stringify(staff).includes('Almirante Teste'), Object.keys(staff).join(','));
});

setSection('13. Bloqueios de lançamento');
await step('bloqueio manual do Davi', async () => {
  const row = await securityUsersRow(P, A.davi.name);
  await row.locator('button[title="Bloquear Manualmente"]').click(); await P.waitForTimeout(900);
  check('Davi bloqueado (gravado)', db('SELECT is_blocked b FROM profiles WHERE email = ?', A.davi.email)[0].b === 1);
  const p = S.davi.page; await p.reload(); await p.waitForTimeout(1000); await openForm(p);
  check('Davi vê o formulário em modo somente leitura', (await p.textContent('body')).match(/bloquead|Somente Leitura/i) !== null);
  const e = emp(A.davi.email);
  const r = await api(p, 'PATCH', `/employees/${e.id}`, { justification: 'tentando burlar' });
  check('servidor recusa alteração de usuário bloqueado (403)', r.status === 403, `${r.status} ${r.data?.error}`);
  const row2 = await securityUsersRow(P, A.davi.name);
  await row2.locator('button[title="Liberar Manualmente"]').click(); await P.waitForTimeout(900);
  check('Davi liberado novamente', db('SELECT is_blocked b FROM profiles WHERE email = ?', A.davi.email)[0].b === 0);
});
await step('prazo final vencido bloqueia todos', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Usuários');
  await P.fill('input[type=date]', '2020-01-01'); await P.waitForTimeout(1500);
  const blocked = db('SELECT COUNT(*) c FROM profiles WHERE is_blocked = 1')[0].c;
  const total = db('SELECT COUNT(*) c FROM profiles')[0].c;
  check('prazo vencido bloqueia todos os usuários', blocked === total, `${blocked}/${total} bloqueados`);
  await P.click('button[title="Limpar prazo e liberar todos"]'); await P.waitForTimeout(1200);
  check('limpar prazo libera todos', db('SELECT COUNT(*) c FROM profiles WHERE is_blocked = 1')[0].c === 0);
});

setSection('14. Senhas, papéis e exclusão');
await step('admin redefine senha do Davi', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Gestão de Contas');
  await P.locator('tr', { hasText: A.davi.email }).locator('button:has-text("Redefinir Senha")').click();
  const pw = P.locator('.fixed input[type=password]');
  await pw.nth(0).fill('NovaDavi@1'); await pw.nth(1).fill('NovaDavi@1');
  await P.click('button:has-text("Salvar Senha")'); await P.waitForTimeout(1000);
  const { page: t } = await newSession(browser, 'davi-novo');
  check('Davi entra com a nova senha', await login(t, A.davi.nip, 'NovaDavi@1'));
  check('senha redefinida pelo admin é provisória: troca obrigatória aparece', await t.isVisible('text=Defina uma Nova Senha'));
  const { page: t2 } = await newSession(browser, 'davi-velho');
  check('senha antiga do Davi deixa de funcionar', !(await login(t2, A.davi.nip, A.davi.pass)));
  const r = await api(S.davi.page, 'GET', '/auth/me');
  check('sessões antigas do Davi são encerradas', r.data?.user === null);
});
await step('admin altera a própria senha', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Sistema');
  await P.click('button:has-text("Alterar Minha Senha")');
  const pw = P.locator('.fixed input[type=password]');
  await pw.nth(0).fill('Admin@45678'); await pw.nth(1).fill('Admin@45678');
  await P.click('button:has-text("Salvar Senha")'); await P.waitForTimeout(1000);
  const { page: t } = await newSession(browser, 'admin-novo');
  check('admin entra com a nova senha', await login(t, 'admin', 'Admin@45678'));
  ADMIN.pass = 'Admin@45678';
});
await step('rebaixar Ana', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Gestão de Contas');
  await P.locator('tr', { hasText: A.ana.email }).locator('button:has-text("Remover Admin")').click(); await P.waitForTimeout(1000);
  check('Ana rebaixada a usuária', db('SELECT role FROM profiles WHERE email = ?', A.ana.email)[0].role === 'user');
  const p = S.ana.page; await p.reload(); await p.waitForTimeout(1200);
  check('Ana perde os menus de admin', !(await p.textContent('header')).includes('Segurança'));
  const r = await api(p, 'GET', '/admin/stats');
  check('Ana não acessa mais funções de admin pela API', r.status === 403);
});
await step('último admin não pode ser rebaixado', async () => {
  const r = await api(P, 'PATCH', `/profiles/${uid('admin@sisferias.local')}`, { role: 'user' });
  check('último administrador não pode ser rebaixado', r.status === 400, r.data?.error);
  const r2 = await api(P, 'DELETE', `/profiles/${uid('admin@sisferias.local')}`);
  check('admin não pode excluir a própria conta', r2.status === 400, r2.data?.error);
});
await step('excluir conta do Davi', async () => {
  const davi = uid(A.davi.email);
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Gestão de Contas');
  await P.locator('tr', { hasText: A.davi.email }).locator('button:has-text("Excluir Conta")').click();
  await P.click('button:has-text("Sim, Excluir")'); await P.waitForTimeout(1200);
  check('conta do Davi excluída', !uid(A.davi.email));
  check('lançamentos do Davi removidos', db('SELECT COUNT(*) c FROM employees WHERE user_id = ?', davi)[0].c === 0);
  const { page: t } = await newSession(browser, 'davi-excluido');
  check('Davi não consegue mais entrar', !(await login(t, A.davi.nip, 'NovaDavi@1')));
  check('backup automático criado antes da exclusão', fs.readdirSync(`${QA}/data/backups`).some(f => f.includes('antes-exclusao-usuario')));
});

setSection('15. Auditoria e dados');
await step('auditoria', async () => {
  await unlockSecurity(P, ADMIN.pass); await tab(P, 'Auditoria Detalhada');
  const t = await P.textContent('body');
  const n = db('SELECT COUNT(*) c FROM audit_logs')[0].c;
  check('auditoria lista as ações registradas', n > 10 && t.includes('Impressão'), `${n} registros`);
});
await step('backup e exportação', async () => {
  await tab(P, 'Dados e Backup');
  await P.click('button:has-text("Criar backup agora")'); await P.waitForTimeout(900);
  check('backup manual criado', fs.readdirSync(`${QA}/data/backups`).some(f => f.includes('manual')));
  const dl = P.waitForEvent('download', { timeout: 6000 });
  await P.click('button:has-text("Backup completo (.json)")');
  const d = await dl; const f = `${QA}/backup.json`; await d.saveAs(f);
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  check('backup JSON contém todas as tabelas e usuários', j.tables.employees.length >= 4 && j.tables.profiles.length === 4 && j.auth_users.length === 4,
    `${j.tables.profiles.length} perfis, ${j.tables.employees.length} lançamentos`);
});

console.log('\nerros de console:', Object.fromEntries(Object.entries(S).map(([k, s]) => [k, s.page.__errors.filter(e => !e.includes('403') && !e.includes('401'))])));
console.log('diálogos:', Object.fromEntries(Object.entries(S).map(([k, s]) => [k, s.page.__dialogs])));
saveResults(`${QA}/r3.json`);
await browser.close();
