// Arquivo data/ADMIN_INICIAL.txt: some quando a senha provisória deixa de valer, para uma
// atualização (ou o instalador) não mostrar uma senha que não funciona mais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, client } from './helpers.mjs';

const arquivo = (srv) => path.join(srv.dataDir, 'ADMIN_INICIAL.txt');
const senhaDoArquivo = (srv) => fs.readFileSync(arquivo(srv), 'utf8').match(/^Senha provisória: (.+)$/m)[1].trim();

test('senha provisória: o arquivo some depois da troca e não volta na atualização', async () => {
  // Sem ADMIN_PASSWORD: o sistema gera a senha provisória e grava o arquivo.
  let srv = await startServer({ env: { ADMIN_PASSWORD: undefined } });
  const dataDir = srv.dataDir;
  try {
    assert.ok(fs.existsSync(arquivo(srv)), 'arquivo criado na primeira instalação');
    const provisoria = senhaDoArquivo(srv);
    const original = fs.readFileSync(arquivo(srv), 'utf8');

    // Reiniciar sem trocar a senha (ex.: atualização antes do primeiro acesso): o arquivo continua.
    await srv.stop();
    srv = await startServer({ dataDir, env: { ADMIN_PASSWORD: undefined } });
    assert.ok(fs.existsSync(arquivo(srv)), 'senha ainda vale: arquivo mantido');

    // Primeiro acesso e troca obrigatória: o arquivo é apagado na hora.
    const admin = client(srv.base);
    assert.equal((await admin.login('admin', provisoria)).status, 200);
    assert.equal((await admin.post('/auth/password', { current_password: provisoria, password: 'Admin@NovaSenha26' })).status, 200);
    assert.equal(fs.existsSync(arquivo(srv)), false, 'arquivo apagado depois da troca');

    // Instalação antiga que ainda tem o arquivo (de antes desta correção): a atualização o apaga ao iniciar.
    await srv.stop();
    fs.writeFileSync(arquivo(srv), original);
    srv = await startServer({ dataDir, env: { ADMIN_PASSWORD: undefined } });
    assert.equal(fs.existsSync(arquivo(srv)), false, 'arquivo antigo apagado na atualização');

    // A senha que vale é a trocada.
    assert.equal((await client(srv.base).login('admin', 'Admin@NovaSenha26')).status, 200);
  } finally {
    await srv.stop();
  }
});
