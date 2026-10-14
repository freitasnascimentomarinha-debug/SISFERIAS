// Redefine (ou cria) um administrador pela linha de comando, útil quando
// ninguém consegue entrar no sistema.
//
//   npm run admin -- --senha NOVA_SENHA
//   npm run admin -- --login 12345678 --senha NOVA_SENHA
//
// --login aceita NIP ou e-mail. Sem --login, usa a conta "admin" criada na
// instalação (ou a cria, se não existir).
import { db, hashPassword, newId, nowIso, upsertRow, transaction } from '../server/db.js';
import { destroyUserSessions } from '../server/auth.js';
import { config } from '../server/config.js';

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const password = arg('senha');
const login = arg('login') || 'admin';
if (!password || password.length < config.minPasswordLength) {
  console.error(`Uso: npm run admin -- [--login NIP_OU_EMAIL] --senha NOVA_SENHA   (mínimo ${config.minPasswordLength} caracteres)`);
  process.exit(1);
}

const profile = login.includes('@')
  ? db.prepare('SELECT * FROM profiles WHERE email = ?').get(login)
  : db.prepare('SELECT * FROM profiles WHERE nip = ? ORDER BY created_at LIMIT 1').get(login);

transaction(() => {
  if (profile) {
    const hash = hashPassword(password);
    const auth = db.prepare('SELECT id FROM auth_users WHERE id = ?').get(profile.id);
    if (auth) db.prepare('UPDATE auth_users SET password_hash = ? WHERE id = ?').run(hash, profile.id);
    else db.prepare('INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(profile.id, profile.email, hash, nowIso());
    db.prepare("UPDATE profiles SET role = 'admin', is_blocked = 0 WHERE id = ?").run(profile.id);
    destroyUserSessions(profile.id);
    console.log(`Senha redefinida e acesso de administrador garantido para: ${profile.name} (${profile.email}).`);
  } else if (login === 'admin') {
    const id = newId();
    db.prepare('INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(id, config.adminEmail, hashPassword(password), nowIso());
    upsertRow('profiles', {
      id, email: config.adminEmail, name: 'Administrador', war_name: 'ADMIN', nip: 'admin',
      role: 'admin', is_blocked: false, view_all_sectors: true,
    });
    console.log(`Administrador criado. Login: admin  |  e-mail: ${config.adminEmail}`);
  } else {
    console.error(`Nenhum usuário encontrado com NIP/e-mail "${login}".`);
    process.exitCode = 1;
  }
});
