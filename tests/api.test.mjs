// Testes do servidor (API, regras de permissão e persistência).
// Executar: npm test
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, client, ADMIN_PASSWORD } from './helpers.mjs';

let srv;
let admin;      // administrador inicial
let bruno;      // usuário do setor 10
let carla;      // usuária do setor 20
const ids = {};

const register = (c, p) => c.post('/auth/register', { password: 'Senha@123', category: 'praca', rank: 'CB', ...p });

before(async () => {
  srv = await startServer();
  admin = client(srv.base);
  bruno = client(srv.base);
  carla = client(srv.base);
});
after(async () => { await srv?.stop(); });

describe('instalação e login', () => {
  it('cria o administrador inicial na primeira execução', async () => {
    assert.match(srv.output(), /acesso inicial do administrador/);
    const r = await admin.login('admin', ADMIN_PASSWORD);
    assert.equal(r.status, 200);
    assert.equal(r.data.user.role, 'admin');
  });

  it('cadastro aplica as regras (senha mínima, e-mail e NIP únicos)', async () => {
    const anon = client(srv.base);
    assert.equal((await register(anon, { name: 'Curta', email: 'c@x.mil.br', password: '12345' })).status, 400);
    const b = await register(anon, { name: 'Bruno Costa', war_name: 'BRUNO', email: 'bruno@mb.mil.br', nip: '20000002', sector: '10', specialization: 'ma' });
    assert.equal(b.status, 201);
    ids.bruno = b.data.id;
    const c = await register(anon, { name: 'Carla Dias', war_name: 'CARLA', email: 'carla@mb.mil.br', nip: '30000003', sector: '20' });
    ids.carla = c.data.id;
    assert.equal((await register(anon, { name: 'Dup', email: 'BRUNO@mb.mil.br', nip: '1' })).status, 409, 'e-mail repetido (sem diferenciar maiúsculas)');
    assert.equal((await register(anon, { name: 'Dup', email: 'outro@mb.mil.br', nip: '20000002' })).status, 409, 'NIP repetido');
  });

  it('login por NIP e por e-mail; senha errada recusada', async () => {
    assert.equal((await bruno.login('20000002', 'errada')).status, 401);
    assert.equal((await bruno.login('20000002', 'Senha@123')).status, 200);
    assert.equal((await carla.login('carla@mb.mil.br', 'Senha@123')).status, 200);
  });

  it('"Quadro/Esp." do cadastro fica gravado no servidor', async () => {
    const r = await bruno.get(`/print-preferences/${ids.bruno}`);
    assert.equal(r.data.specialization, 'MA');
  });

  it('usuário troca a própria senha somente informando a atual', async () => {
    assert.equal((await bruno.post('/auth/password', { password: 'NovaSenha1' })).status, 400);
    assert.equal((await bruno.post('/auth/password', { current_password: 'errada', password: 'NovaSenha1' })).status, 400);
    assert.equal((await bruno.post('/auth/password', { current_password: 'Senha@123', password: '123' })).status, 400, 'senha curta');
    assert.equal((await bruno.post('/auth/password', { current_password: 'Senha@123', password: 'NovaSenha1' })).status, 200);
    const outro = client(srv.base);
    assert.equal((await outro.login('20000002', 'Senha@123')).status, 401);
    assert.equal((await outro.login('20000002', 'NovaSenha1')).status, 200);
  });
});

describe('lançamentos de férias e permissões', () => {
  it('usuário lança e altera as próprias férias (um registro por ano)', async () => {
    const parcels = [{ id: 'p1', startDate: '2026-01-05', endDate: '2026-01-19', days: 15 }];
    const a = await bruno.post('/employees', { user_id: ids.bruno, planning_year: 2025, name: 'Bruno Costa', sector: '10', vacation_parcels: parcels });
    assert.equal(a.status, 200);
    ids.brunoEmp = a.data.id;
    const b = await bruno.post('/employees', { user_id: ids.bruno, planning_year: 2025, name: 'Bruno Costa', sector: '10', vacation_parcels: [...parcels, { id: 'p2', startDate: '2026-07-01', endDate: '2026-07-15', days: 15 }] });
    assert.equal(b.data.id, ids.brunoEmp, 'mesmo registro, sem duplicar');
    assert.equal(b.data.vacation_parcels.length, 2);
    const c = await carla.post('/employees', { user_id: ids.carla, planning_year: 2025, name: 'Carla Dias', sector: '20', vacation_parcels: [] });
    ids.carlaEmp = c.data.id;
  });

  it('usuário não altera, cria nem apaga férias de outra pessoa', async () => {
    assert.equal((await bruno.patch(`/employees/${ids.carlaEmp}`, { justification: 'x' })).status, 403);
    assert.equal((await bruno.post('/employees', { user_id: ids.carla, planning_year: 2025 })).status, 403);
    assert.equal((await bruno.del(`/employees/${ids.carlaEmp}`)).status, 403);
    assert.equal((await bruno.get(`/print-preferences/${ids.carla}`)).status, 403);
  });

  it('usuário comum não acessa funções de administrador', async () => {
    for (const [m, p] of [['get', '/admin/stats'], ['get', '/audit-logs'], ['get', '/admin/export']]) {
      assert.equal((await bruno[m](p)).status, 403, p);
    }
    assert.equal((await bruno.patch(`/profiles/${ids.bruno}`, { role: 'admin' })).status, 403);
    assert.equal((await bruno.post('/auth/elevate', { password: 'NovaSenha1' })).status, 403);
  });

  it('requisição sem o cabeçalho do sistema é recusada', async () => {
    const res = await fetch(`${srv.base}/api/auth/logout`, { method: 'POST' });
    assert.equal(res.status, 403);
  });
});

describe('área de Segurança (confirmação de senha do admin)', () => {
  it('ações administrativas exigem confirmar a senha', async () => {
    const r = await admin.get('/admin/stats');
    assert.equal(r.status, 403);
    assert.equal(r.data.code, 'reauth_required');
    assert.equal((await admin.post('/auth/elevate', { password: 'errada' })).status, 401);
    assert.equal((await admin.post('/auth/elevate', { password: ADMIN_PASSWORD })).status, 200);
    assert.equal((await admin.get('/admin/stats')).status, 200);
  });

  it('admin edita o lançamento de usuário bloqueado; o próprio usuário não', async () => {
    await admin.patch(`/profiles/${ids.bruno}`, { is_blocked: true });
    assert.equal((await bruno.patch(`/employees/${ids.brunoEmp}`, { justification: 'tentativa' })).status, 403);
    const r = await admin.patch(`/employees/${ids.brunoEmp}`, { justification: 'ajuste do admin' });
    assert.equal(r.status, 200);
    assert.equal(r.data.justification, 'ajuste do admin');
    await admin.patch(`/profiles/${ids.bruno}`, { is_blocked: false });
  });

  it('auditoria grava sempre o nome de quem está logado', async () => {
    const r = await bruno.post('/audit-logs', { user_name: 'Administrador', action: 'Alteração', field: 'teste', old_value: '-', new_value: '-' });
    assert.equal(r.data.user_name, 'Bruno Costa');
  });

  it('não é possível rebaixar o último admin nem excluir a própria conta', async () => {
    const me = (await admin.get('/auth/me')).data.user;
    assert.equal((await admin.patch(`/profiles/${me.id}`, { role: 'user' })).status, 400);
    assert.equal((await admin.del(`/profiles/${me.id}`)).status, 400);
  });

  it('redefinir senha de outra pessoa encerra as sessões dela', async () => {
    const c2 = client(srv.base);
    await c2.login('30000003', 'Senha@123');
    assert.equal((await admin.post('/admin/reset-password', { userId: ids.carla, password: '1234' })).status, 400, 'senha curta');
    assert.equal((await admin.post('/admin/reset-password', { userId: ids.carla, password: 'Carla@999' })).status, 200);
    assert.equal((await c2.get('/auth/me')).data.user, null);
    assert.equal((await carla.login('30000003', 'Carla@999')).status, 200);
  });
});

describe('prazo final de lançamento', () => {
  it('prazo vencido bloqueia todos; liberação manual é respeitada; limpar libera', async () => {
    assert.equal((await admin.put('/settings/deadline', { deadline: '2099-12-31' })).data.blocked, false);
    const r = await admin.put('/settings/deadline', { deadline: '2020-01-01' });
    assert.equal(r.data.blocked, true);
    const profiles = (await admin.get('/profiles')).data;
    assert.ok(profiles.every(p => p.is_blocked), 'todos bloqueados');
    await admin.patch(`/profiles/${ids.bruno}`, { is_blocked: false });
    const novo = await register(client(srv.base), { name: 'Eva Nova', email: 'eva@mb.mil.br', nip: '50000005' });
    ids.eva = novo.data.id;
    const after = (await admin.get('/profiles')).data;
    assert.equal(after.find(p => p.id === ids.bruno).is_blocked, false, 'exceção mantida');
    assert.equal(after.find(p => p.id === ids.eva).is_blocked, true, 'conta nova nasce bloqueada');
    await admin.put('/settings/deadline', { deadline: null });
    assert.ok((await admin.get('/profiles')).data.every(p => !p.is_blocked), 'todos liberados');
  });
});

describe('dados: importação, exportação e backups', () => {
  it('exporta e reimporta sem duplicar', async () => {
    const exp = await admin.get('/admin/export');
    assert.equal(exp.data.format, 'sisferias-backup');
    const files = [{ name: 'backup.json', content: JSON.stringify(exp.data) }];
    const before = (await admin.get('/admin/stats')).data.counts;
    const apply = await admin.post('/admin/import/apply', { files });
    assert.equal(apply.status, 200);
    assert.deepEqual(apply.data.after.employees, before.employees);
    assert.deepEqual(apply.data.after.profiles, before.profiles);
  });

  it('CSV: pré-visualização aponta linhas com erro e colunas extras', async () => {
    const csv = 'id;title;content;is_pinned;campo_novo\nn1;Aviso;"Texto; com ;";true;x\n';
    const emp = 'id,user_id,planning_year,vacation_parcels\ne1,u1,2025,{quebrado\n';
    const r = await admin.post('/admin/import/preview', { files: [{ name: 'notices.csv', content: csv }, { name: 'employees.csv', content: emp }] });
    assert.equal(r.data.tables.notices.insert, 1);
    assert.deepEqual(r.data.tables.notices.unmappedColumns, ['campo_novo']);
    assert.equal(r.data.tables.employees.errors.length, 1);
  });

  it('backup manual e cópia para pasta extra', async () => {
    const extra = fs.mkdtempSync(path.join(os.tmpdir(), 'sisferias-copia-'));
    const r = await admin.put('/admin/backup-copy', { dir: extra });
    assert.equal(r.status, 200);
    assert.equal(r.data.backupCopyStatus.ok, true);
    assert.ok(fs.readdirSync(extra).some(f => f.endsWith('.db')), 'cópia gravada na pasta extra');
    assert.equal((await admin.put('/admin/backup-copy', { dir: path.join(srv.dataDir, 'backups') })).status, 400, 'mesma pasta dos backups');
    const fileNotDir = path.join(extra, 'arquivo.txt');
    fs.writeFileSync(fileNotDir, 'x');
    assert.equal((await admin.put('/admin/backup-copy', { dir: path.join(fileNotDir, 'sub') })).status, 400, 'pasta inválida');
    await admin.put('/admin/backup-copy', { dir: '' });
  });

  it('pasta que não responde não trava o sistema (tempo limite)', { skip: process.platform !== 'linux' && 'só no Linux' }, async () => {
    // No Linux, criar pasta dentro de /proc fica sem resposta: simula uma pasta de rede fora do ar.
    const started = Date.now();
    const pending = admin.put('/admin/backup-copy', { dir: '/proc/sisferias-sem-resposta/x' });
    await new Promise(r => setTimeout(r, 1000));
    const t = Date.now();
    const health = await fetch(`${srv.base}/api/health`);
    assert.equal(health.status, 200);
    assert.ok(Date.now() - t < 1000, 'o servidor continua respondendo enquanto a pasta não responde');
    const r = await pending;
    assert.equal(r.status, 400);
    assert.match(r.data.error, /sem resposta/);
    assert.ok(Date.now() - started < 20_000);
  });

  it('excluir usuário apaga os lançamentos dele (com backup antes)', async () => {
    const r = await admin.del(`/profiles/${ids.eva}`);
    assert.equal(r.status, 200);
    assert.ok(fs.readdirSync(path.join(srv.dataDir, 'backups')).some(f => f.includes('antes-exclusao-usuario')));
    assert.equal((await client(srv.base).login('50000005', 'Senha@123')).status, 401);
  });
});

describe('persistência', () => {
  it('dados, senhas e sessões sobrevivem a reiniciar o servidor', async () => {
    const snapshot = (await admin.get('/employees')).data;
    const cookie = bruno.rawCookie();
    await srv.stop();
    srv = await startServer({ dataDir: srv.dataDir, port: srv.port });
    assert.doesNotMatch(srv.output(), /acesso inicial do administrador/, 'não recria o admin');
    assert.equal((await admin.post('/auth/elevate', { password: ADMIN_PASSWORD })).status, 200, 'sessão do admin continua válida');
    assert.deepEqual((await admin.get('/employees')).data, snapshot);
    assert.ok(cookie);
    assert.equal((await bruno.get('/auth/me')).data.user.id, ids.bruno);
  });
});
