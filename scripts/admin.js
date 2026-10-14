// Recuperação de acesso pela linha de comando (pode ser usado com o
// SISFERIAS ligado ou desligado).
//
//   npm run admin -- --senha NOVA_SENHA                     redefine a senha do "admin"
//   npm run admin -- --login 12345678 --senha NOVA_SENHA    de outra conta (vira administrador)
//   npm run admin -- --login 12345678 --desbloquear         libera conta bloqueada por tentativas
//
// --login aceita NIP ou e-mail. Sem --login, usa a conta "admin" criada na
// instalação (ou a cria, se não existir). A senha informada aqui é
// provisória: o sistema pede uma nova no primeiro acesso.
import {
  connectDb, closeDb, one, run, upsertRow, transaction, newId, setAuthPassword, addAudit,
} from '../server/db.js';
import { destroyUserSessions } from '../server/auth.js';
import { config } from '../server/config.js';
import { blindIndex, decrypt, passwordProblems, PASSWORD_RULE_TEXT } from '../server/crypto.js';

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const password = arg('senha');
const unlock = args.includes('--desbloquear');
const login = arg('login') || 'admin';
if (!password && !unlock) {
  console.error('Uso: npm run admin -- [--login NIP_OU_EMAIL] --senha NOVA_SENHA');
  console.error('     npm run admin -- --login NIP_OU_EMAIL --desbloquear');
  process.exit(1);
}
if (password && passwordProblems(password).length) {
  console.error(`Senha fora da regra: ${PASSWORD_RULE_TEXT}.`);
  console.error(`Falta: ${passwordProblems(password).join(', ')}.`);
  process.exit(1);
}

await connectDb();
try {
  const row = login.includes('@')
    ? await one('SELECT * FROM profiles WHERE email_hash = ?', [blindIndex(login)])
    : await one('SELECT * FROM profiles WHERE nip_hash = ? ORDER BY created_at LIMIT 1', [blindIndex(login)]);
  const profile = row && { id: row.id, name: decrypt(row.name), email: decrypt(row.email) };

  if (!profile && login !== 'admin') {
    console.error(`Nenhum usuário encontrado com NIP/e-mail "${login}".`);
    process.exitCode = 1;
  } else if (!password) {
    if (!profile) throw new Error('Conta "admin" não encontrada.');
    await run('UPDATE auth_users SET locked_at = NULL, failed_attempts = 0 WHERE id = ?', [profile.id]);
    await addAudit('Linha de comando', 'Desbloqueio', 'Conta de acesso liberada', profile.name, 'npm run admin');
    console.log(`Conta liberada: ${profile.name} (${profile.email}).`);
  } else if (profile) {
    await transaction(async () => {
      await setAuthPassword(profile.id, profile.email, password, { mustChange: true });
      await run("UPDATE profiles SET role = 'admin', is_blocked = FALSE WHERE id = ?", [profile.id]);
      await destroyUserSessions(profile.id);
      await addAudit('Linha de comando', 'Senha', 'Senha redefinida e acesso de administrador', profile.name, 'npm run admin');
    });
    console.log(`Senha redefinida e acesso de administrador garantido para: ${profile.name} (${profile.email}).`);
    console.log('A senha é provisória: o sistema pedirá uma nova no primeiro acesso.');
  } else {
    const id = newId();
    await transaction(async () => {
      await setAuthPassword(id, config.adminEmail, password, { mustChange: true });
      await upsertRow('profiles', {
        id, email: config.adminEmail, name: 'Administrador', war_name: 'ADMIN', nip: 'admin',
        role: 'admin', is_blocked: false, view_all_sectors: true,
      });
    });
    console.log(`Administrador criado. Login: admin  |  e-mail: ${config.adminEmail}`);
    console.log('A senha é provisória: o sistema pedirá uma nova no primeiro acesso.');
  }
} finally {
  await closeDb({ stopEmbedded: 'if-started' });
}
