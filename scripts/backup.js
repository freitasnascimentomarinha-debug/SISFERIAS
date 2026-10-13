// Cria um backup do banco: npm run backup
import { createBackup } from '../server/backup.js';

const file = createBackup('manual');
console.log(`Backup criado: ${file}`);
