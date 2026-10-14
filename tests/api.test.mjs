// Testes do servidor (API, regras de permissão e persistência).
// Executar: npm test
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { DatabaseSync } from 'node:sqlite';
import { startServer, client, ADMIN_PASSWORD } from './helpers.mjs';

let srv;
let admin;      // administrador inicial
let bruno;      // usuário do setor 10
let carla;      // usuária do setor 20
const ids = {};

const register = (c, p) => c.post('/auth/register', { password: 'Senha@12345', category: 'praca', rank: 'CB', ...p });

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

  it('cadastro aplica as regras (senha da DCTIM, e-mail e NIP únicos)', async () => {
    const anon = client(srv.base);
    assert.equal((await register(anon, { name: 'Curta', email: 'c@x.mil.br', password: '12345' })).status, 400);
    for (const fraca of ['senhafraca@123', 'SENHAFRACA@123', 'SenhaFraca@', 'SenhaFraca123', 'Sf@1']) {
      const r = await register(anon, { name: 'Fraca', email: 'f@x.mil.br', password: fraca });
      assert.equal(r.status, 400, fraca);
      assert.equal(r.data.code, 'password_rule');
    }
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
    assert.equal((await bruno.login('20000002', 'Senha@12345')).status, 200);
    assert.equal((await carla.login('carla@mb.mil.br', 'Senha@12345')).status, 200);
  });

  it('"Quadro/Esp." do cadastro fica gravado no servidor', async () => {
    const r = await bruno.get(`/print-preferences/${ids.bruno}`);
    assert.equal(r.data.specialization, 'MA');
  });

  it('usuário troca a própria senha somente informando a atual', async () => {
    assert.equal((await bruno.post('/auth/password', { password: 'NovaSenha@1' })).status, 400);
    assert.equal((await bruno.post('/auth/password', { current_password: 'errada', password: 'NovaSenha@1' })).status, 400);
    assert.equal((await bruno.post('/auth/password', { current_password: 'Senha@12345', password: '123' })).status, 400, 'senha curta');
    assert.equal((await bruno.post('/auth/password', { current_password: 'Senha@12345', password: 'Senha@12345' })).status, 400, 'igual à atual');
    assert.equal((await bruno.post('/auth/password', { current_password: 'Senha@12345', password: 'NovaSenha@1' })).status, 200);
    const outro = client(srv.base);
    assert.equal((await outro.login('20000002', 'Senha@12345')).status, 401);
    assert.equal((await outro.login('20000002', 'NovaSenha@1')).status, 200);
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
    assert.equal((await bruno.post('/auth/elevate', { password: 'NovaSenha@1' })).status, 403);
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

  it('redefinir senha de outra pessoa encerra as sessões dela e exige troca no 1º acesso', async () => {
    const c2 = client(srv.base);
    await c2.login('30000003', 'Senha@12345');
    assert.equal((await admin.post('/admin/reset-password', { userId: ids.carla, password: '1234' })).status, 400, 'senha curta');
    assert.equal((await admin.post('/admin/reset-password', { userId: ids.carla, password: 'Provisoria@1' })).status, 200);
    assert.equal((await c2.get('/auth/me')).data.user, null);
    const l = await carla.login('30000003', 'Provisoria@1');
    assert.equal(l.status, 200);
    assert.equal(l.data.user.must_change_password, true);
    const blocked = await carla.get('/employees');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.data.code, 'password_change_required');
    assert.equal((await carla.post('/auth/password', { current_password: 'Provisoria@1', password: 'Carla@Nova99' })).status, 200);
    assert.equal((await carla.get('/employees')).status, 200);
    assert.equal((await carla.get('/auth/me')).data.user.must_change_password, false);
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
    assert.ok(fs.readdirSync(extra).some(f => /^sisferias_.*\.json$/.test(f)), 'cópia gravada na pasta extra');
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
    assert.equal((await client(srv.base).login('50000005', 'Senha@12345')).status, 401);
  });

  it('backup automático guarda os dados pessoais cifrados e é restaurável', async () => {
    const r = await admin.post('/admin/backups');
    assert.equal(r.status, 201);
    const content = fs.readFileSync(path.join(srv.dataDir, 'backups', r.data.file), 'utf8');
    const dump = JSON.parse(content);
    assert.equal(dump.encrypted, true);
    assert.doesNotMatch(content, /Bruno Costa|20000002|bruno@mb\.mil\.br/, 'nada de nome, NIP ou e-mail legível');
    const restore = await admin.post('/admin/import/apply', { files: [{ name: r.data.file, content }], mode: 'replace' });
    assert.equal(restore.status, 200);
    assert.equal((await admin.get('/employees')).data.find(e => e.user_id === ids.bruno).name, 'Bruno Costa');
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

describe('imagens (foto e logo)', () => {
  let srv2;
  let adm;
  before(async () => {
    srv2 = await startServer();
    adm = client(srv2.base);
    await adm.login('admin', ADMIN_PASSWORD);
    await adm.post('/auth/elevate', { password: ADMIN_PASSWORD });
  });
  after(async () => { await srv2?.stop(); });

  it('aceita imagem pequena e recusa imagem grande demais ou formato inválido', async () => {
    const small = 'data:image/png;base64,' + Buffer.alloc(2000, 1).toString('base64');
    const big = 'data:image/jpeg;base64,' + Buffer.alloc(2.5 * 1024 * 1024, 1).toString('base64');
    assert.equal((await adm.put('/settings', { logo_url: small })).status, 200);
    assert.equal((await adm.put('/settings', { logo_url: big })).status, 413);
    assert.equal((await adm.put('/settings', { logo_url: 'data:text/html;base64,PGgxPg==' })).status, 400);
    const me = (await adm.get('/auth/me')).data.user;
    const e = await adm.post('/employees', { user_id: me.id, planning_year: 2025, vacation_parcels: [], photo_url: small });
    assert.equal(e.status, 200);
    assert.equal((await adm.patch(`/employees/${e.data.id}`, { photo_url: big })).status, 413);
  });
});

describe('HTTPS', () => {
  let srv3;
  // Sem HTTPS no ambiente: vale o padrão do sistema, que é HTTPS ligado.
  before(async () => { srv3 = await startServer({ env: { HTTPS: undefined } }); });
  after(async () => { await srv3?.stop(); });

  const httpsRequest = (pathname, { method = 'GET', body } = {}) => new Promise((resolve, reject) => {
    const req = https.request({
      host: '127.0.0.1', port: srv3.port, path: pathname, method,
      rejectUnauthorized: false, // certificado próprio da rede interna
      headers: { 'X-Requested-With': 'sisferias', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    }, res => {
      const cert = res.socket?.getPeerCertificate?.(); // ler antes de a conexão fechar
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data, cert }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });

  it('HTTPS é o padrão (sem configuração) e responde com certificado provisório', async () => {
    const r = await httpsRequest('/api/health');
    assert.equal(r.status, 200);
    assert.match(r.cert.subjectaltname, /IP Address:127\.0\.0\.1/);
    assert.ok(fs.existsSync(path.join(srv3.dataDir, 'certs', 'sisferias.crt')));
  });

  it('cookie de sessão só trafega criptografado (Secure)', async () => {
    const r = await httpsRequest('/api/auth/login', { method: 'POST', body: { login: 'admin', password: ADMIN_PASSWORD } });
    assert.equal(r.status, 200);
    assert.match(String(r.headers['set-cookie']), /;\s*Secure/i);
  });

  it('certificado público disponível para instalar nos computadores', async () => {
    const r = await httpsRequest('/api/certificado');
    assert.equal(r.status, 200);
    assert.match(r.data, /BEGIN CERTIFICATE/);
  });
});

// ---------------------------------------------------------------------------
// Normas da DCTIM (DCTIMBOTEC 31/002/2020, DCTIMBOTEC 30/002/2023, DCTIMARINST 30-17)
// ---------------------------------------------------------------------------

describe('conformidade com as normas da DCTIM', () => {
  let s4;
  let adm;
  before(async () => {
    s4 = await startServer();
    adm = client(s4.base);
    await adm.login('admin', ADMIN_PASSWORD);
    await adm.post('/auth/elevate', { password: ADMIN_PASSWORD });
    await client(s4.base).post('/auth/register', { name: 'Davi Lima', war_name: 'DAVI', email: 'davi@mb.mil.br', nip: '40000004', password: 'Davi@123456', sector: '10' });
  });
  after(async () => { await s4?.stop(); });

  it('3.1.d: respostas da API e a página não ficam em cache', async () => {
    const api = await fetch(`${s4.base}/api/health`);
    assert.equal(api.headers.get('cache-control'), 'no-store');
  });

  it('3.1.f: login só por POST', async () => {
    assert.equal((await fetch(`${s4.base}/api/auth/login?login=admin&password=x`)).status, 405);
  });

  it('3.2.f: a mesma mensagem para usuário inexistente, senha errada e conta bloqueada', async () => {
    const anon = client(s4.base);
    const a = await anon.login('99999999', 'Qualquer@123');
    const b = await anon.login('40000004', 'Errada@12345');
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.data.error, b.data.error);
    assert.match(a.data.error, /Usuário e\/ou senha inválidos/);
    assert.equal((await anon.login('40000004', 'Davi@123456')).status, 200, 'erro anterior não acumula após acerto');
  });

  it('3.2.g: 5 tentativas inválidas seguidas bloqueiam a conta até o admin liberar', async () => {
    const davi = client(s4.base);
    assert.equal((await davi.login('40000004', 'Davi@123456')).status, 200);
    const anon = client(s4.base);
    const first = await anon.login('40000004', 'Errada@00001');
    for (let i = 2; i <= 5; i += 1) await anon.login('40000004', `Errada@0000${i}`);
    const locked = await anon.login('40000004', 'Davi@123456');
    assert.equal(locked.status, 401, 'senha certa não entra com a conta bloqueada');
    assert.equal(locked.data.error, first.data.error, 'sem revelar o bloqueio');
    assert.equal((await davi.get('/auth/me')).data.user, null, 'sessões abertas são encerradas');
    const p = (await adm.get('/profiles')).data.find(x => x.nip === '40000004');
    assert.equal(p.account_locked, true);
    const audit = (await adm.get('/audit-logs')).data;
    assert.ok(audit.some(l => l.field === 'Conta de acesso bloqueada'), 'bloqueio registrado na auditoria');
    const unlocked = await adm.patch(`/profiles/${p.id}`, { unlock: true });
    assert.equal(unlocked.data.account_locked, false);
    assert.equal((await anon.login('40000004', 'Davi@123456')).status, 200);
  });

  it('3.2.d: senha provisória do admin inicial exige troca no primeiro acesso', async () => {
    const s5 = await startServer({ env: { ADMIN_PASSWORD: '' } });
    try {
      const info = fs.readFileSync(path.join(s5.dataDir, 'ADMIN_INICIAL.txt'), 'utf8');
      const temp = /Senha provisória: (\S+)/.exec(info)[1];
      const c = client(s5.base);
      assert.equal((await c.login('admin', temp)).data.user.must_change_password, true);
      assert.equal((await c.get('/profiles')).data.code, 'password_change_required');
    } finally {
      await s5.stop();
    }
  });

  it('3.2.c: senhas guardadas só como hash (ID + senha, bcrypt)', async () => {
    const rows = await s4.sql('SELECT password_hash FROM auth_users');
    assert.ok(rows.every(r => r.password_hash.startsWith('sf2$$2')), 'formato novo');
    assert.ok(!rows.some(r => r.password_hash.includes('Davi@123456')));
  });

  it('3.3 / 30-17 4.5: dados pessoais cifrados no banco (AES-256-GCM)', async () => {
    const rows = await s4.sql("SELECT name, email, nip, war_name FROM profiles");
    for (const r of rows) for (const v of Object.values(r)) assert.match(v, /^enc:v1:/);
    const emails = await s4.sql('SELECT email FROM auth_users');
    assert.ok(emails.every(r => r.email.startsWith('enc:v1:')));
    // Mesmo o superusuário do banco só vê o texto cifrado.
    const all = JSON.stringify(await s4.sql('SELECT * FROM profiles', [], { role: 'postgres' }));
    assert.doesNotMatch(all, /Davi Lima|40000004|davi@mb/);
  });

  it('30-17 4.1: usuário de banco da aplicação com privilégio mínimo', async () => {
    await assert.rejects(s4.sql('CREATE TABLE invasora (x int)'), /permission denied/);
    await assert.rejects(s4.sql('DROP TABLE profiles'), /must be owner/);
    await assert.rejects(s4.sql('DELETE FROM operation_log'), /permission denied/);
    await assert.rejects(s4.sql("UPDATE audit_logs SET action = 'x'"), /permission denied/);
    await assert.rejects(s4.sql('DELETE FROM audit_logs'), /permission denied/);
    assert.ok((await s4.sql('SELECT COUNT(*)::int c FROM profiles'))[0].c >= 1, 'mas lê e grava dados normalmente');
  });

  it('30-17 4.4: registro de todas as operações, inclusive recusadas', async () => {
    const ops = (await adm.get('/admin/operations')).data;
    const names = ops.map(o => o.operation);
    assert.ok(names.includes('Login'));
    assert.ok(ops.some(o => o.operation === 'Login' && o.status === 401 && /Falha de login/.test(o.detail)), 'tentativa recusada registrada');
    assert.ok(names.includes('Alteração de usuário'), 'desbloqueio registrado');
    assert.ok(ops.some(o => o.user === 'Administrador' && o.ip), 'quem e de onde');
    const raw = await s4.sql('SELECT user_label, ip, detail FROM operation_log WHERE user_label IS NOT NULL LIMIT 5');
    assert.ok(raw.every(r => r.user_label.startsWith('enc:v1:') && r.ip.startsWith('enc:v1:')), 'cifrado no banco');
  });

  it('30-17 4.3: ambiente de homologação identificado e dados fictícios', async () => {
    assert.equal((await fetch(`${s4.base}/api/ambiente`).then(r => r.json())).environment, 'producao');
    const s6 = await startServer({ env: { AMBIENTE: 'homologacao' } });
    try {
      assert.equal((await fetch(`${s6.base}/api/ambiente`).then(r => r.json())).environment, 'homologacao');
    } finally {
      await s6.stop();
    }
  });

  it('chave errada ou ausente: o sistema não inicia (não grava dados ilegíveis)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sisferias-chave-'));
    const s7 = await startServer({ dataDir: dir });
    await s7.stop();
    const keyFile = path.join(dir, 'chave-dados.key');
    const original = fs.readFileSync(keyFile);
    fs.writeFileSync(keyFile, Buffer.alloc(32, 7).toString('base64'));
    await assert.rejects(startServer({ dataDir: dir }), /não corresponde a este banco/);
    fs.rmSync(keyFile);
    await assert.rejects(startServer({ dataDir: dir }), /chave de criptografia dos dados não foi encontrada/);
    fs.writeFileSync(keyFile, original);
    const ok = await startServer({ dataDir: dir });
    await ok.stop();
  });
});

describe('migração dos dados das versões 2.x (SQLite)', () => {
  it('copia os dados, mantém as senhas e renomeia o arquivo antigo', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sisferias-v2-'));
    const old = new DatabaseSync(path.join(dir, 'sisferias.db'));
    // Hash bcrypt (formato das versões 2.x) da senha "antiga1".
    const bcrypt = (await import('bcryptjs')).default;
    old.exec(`
      CREATE TABLE auth_users (id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, created_at TEXT);
      CREATE TABLE profiles (id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT, is_blocked INTEGER, view_all_sectors INTEGER,
        war_name TEXT, nip TEXT, category TEXT, sector TEXT, rank TEXT, extra_json TEXT, created_at TEXT, updated_at TEXT);
      CREATE TABLE employees (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, war_name TEXT, nip TEXT, sector TEXT, category TEXT, rank TEXT,
        planning_year INTEGER, total_vacation_days INTEGER, vacation_parcels TEXT, photo_url TEXT, justification TEXT, extra_json TEXT, created_at TEXT, updated_at TEXT);
    `);
    old.prepare('INSERT INTO auth_users VALUES (?, ?, ?, ?)').run('u-admin', 'chefe@mb.mil.br', bcrypt.hashSync('antiga1', 4), '2025-01-01T00:00:00.000Z');
    old.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('u-admin', 'Chefe Antigo', 'chefe@mb.mil.br', 'admin', 0, 1, 'CHEFE', '12345678', 'oficial', '01', 'CF', '{"legado":"sim"}', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');
    old.prepare('INSERT INTO employees VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('e1', 'u-admin', 'Chefe Antigo', 'CHEFE', '12345678', '01', 'oficial', 'CF', 2026, 30,
      '[{"id":"p1","startDate":"2027-02-01","endDate":"2027-02-15","days":15}]', null, 'motivo', null, '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z');
    old.close();

    const s8 = await startServer({ dataDir: dir });
    try {
      assert.match(s8.output(), /migração\] concluída/);
      assert.doesNotMatch(s8.output(), /acesso inicial do administrador/, 'admin antigo mantido, sem criar outro');
      assert.ok(fs.readdirSync(dir).some(f => f.startsWith('sisferias.db.migrado-')));
      const c = client(s8.base);
      const l = await c.login('12345678', 'antiga1');
      assert.equal(l.status, 200, 'senha antiga continua valendo');
      assert.equal(l.data.user.must_change_password, true, 'mas fora da regra: troca obrigatória');
      await c.post('/auth/password', { current_password: 'antiga1', password: 'Chefe@Nova2026' });
      const emp = (await c.get('/employees')).data;
      assert.equal(emp[0].vacation_parcels[0].startDate, '2027-02-01');
      assert.equal(emp[0].justification, 'motivo');
      const raw = await s8.sql("SELECT password_hash FROM auth_users WHERE id = 'u-admin'");
      assert.ok(raw[0].password_hash.startsWith('sf2$'), 'hash refeito no formato novo no login');
    } finally {
      await s8.stop();
    }
  });
});
