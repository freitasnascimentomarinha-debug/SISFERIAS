// Cria um backup do banco: npm run backup
import { connectDb, closeDb } from '../server/db.js';
import { createBackup } from '../server/backup.js';

await connectDb();
try {
  const file = await createBackup('manual', { copy: false });
  console.log(`Backup criado: ${file}`);
  console.log('Os dados pessoais ficam cifrados no arquivo: guarde também a chave (data/chave-dados.key).');
} finally {
  await closeDb({ stopEmbedded: 'if-started' });
}
