// Restaura um backup (ou uma exportação) do SISFERIAS:
//
//   npm run restaurar -- data/backups/sisferias_2026-10-14_..._diario.json
//   npm run restaurar -- arquivo.json --mesclar      (mantém o que não estiver no arquivo)
//
// Por padrão SUBSTITUI os dados das tabelas presentes no arquivo. Antes de
// gravar, um backup do estado atual é criado automaticamente.
import fs from 'node:fs';
import path from 'node:path';
import { connectDb, closeDb } from '../server/db.js';
import { previewImport, applyImport } from '../server/importer.js';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
if (!file || !fs.existsSync(file)) {
  console.error('Uso: npm run restaurar -- ARQUIVO.json [--mesclar]');
  process.exit(1);
}
const mode = args.includes('--mesclar') ? 'merge' : 'replace';
const files = [{ name: path.basename(file), content: fs.readFileSync(file, 'utf8') }];

await connectDb();
try {
  const report = await previewImport(files, {});
  for (const p of report.problems) console.error(`ERRO ${p.file}: ${p.error}`);
  if (report.problems.length) { process.exitCode = 1; } else {
    const result = await applyImport(files, {}, { mode });
    for (const t of Object.values(result.report.tables)) {
      console.log(`${t.label}: ${t.total} registro(s)${t.errors.length ? `, ${t.errors.length} com erro` : ''}`);
      for (const e of t.errors.slice(0, 5)) console.log(`   linha ${e.line}: ${e.error}`);
    }
    console.log(`Restauração concluída (${mode === 'replace' ? 'substituição' : 'mesclagem'}).`);
    console.log(`Backup do estado anterior: ${result.backupFile}`);
  }
} finally {
  await closeDb({ stopEmbedded: 'if-started' });
}
