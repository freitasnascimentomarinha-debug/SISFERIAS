// Trava do PostgreSQL deixada por um desligamento inesperado (postmaster.pid).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { removerTravaAntiga } from '../server/pgembed.js';

function pasta(conteudo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sisferias-trava-'));
  if (conteudo !== undefined) fs.writeFileSync(path.join(dir, 'postmaster.pid'), conteudo);
  return dir;
}
const existe = (dir) => fs.existsSync(path.join(dir, 'postmaster.pid'));

test('trava de processo que não existe mais é removida', () => {
  const dir = pasta('4242\nC:/SISFERIAS/data/postgres\n');
  assert.equal(removerTravaAntiga(dir, () => null), true);
  assert.equal(existe(dir), false);
});

test('trava cujo número agora é de outro programa é removida', () => {
  const dir = pasta('4242\n');
  assert.equal(removerTravaAntiga(dir, () => 'explorer.exe'), true);
  assert.equal(existe(dir), false);
});

test('trava do PostgreSQL em execução é mantida', () => {
  for (const nome of ['postgres.exe', 'postgres']) {
    const dir = pasta('4242\n');
    assert.equal(removerTravaAntiga(dir, () => nome), false);
    assert.equal(existe(dir), true);
  }
});

test('sem trava, nada muda', () => {
  const dir = pasta();
  assert.equal(removerTravaAntiga(dir, () => null), false);
});

test('trava ilegível é removida', () => {
  const dir = pasta('lixo\n');
  assert.equal(removerTravaAntiga(dir, () => 'postgres'), true);
  assert.equal(existe(dir), false);
});
