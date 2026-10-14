// Popula o banco com DADOS FICTÍCIOS para o ambiente de homologação/testes
// (DCTIMARINST 30-17, item 4.3: bases de não-produção devem conter dados
// fictícios).
//
//   npm run dados-ficticios                  30 militares fictícios
//   npm run dados-ficticios -- --quantidade 80
//
// Só funciona com o ambiente configurado como homologação ("ambiente":
// "homologacao" em data/config.json, ou AMBIENTE=homologacao), para nunca
// misturar dados fictícios com os reais. Senha de todos: Teste@2026#
import { config } from '../server/config.js';

if (config.environment !== 'homologacao') {
  console.error('Este comando só pode ser usado no ambiente de homologação.');
  console.error('Configure "ambiente": "homologacao" em data/config.json (ou AMBIENTE=homologacao) numa instalação SEPARADA da de produção.');
  process.exit(1);
}

const { connectDb, closeDb, upsertRow, transaction, newId, setAuthPassword, one } = await import('../server/db.js');
const { blindIndex } = await import('../server/crypto.js');

const args = process.argv.slice(2);
const qIdx = args.indexOf('--quantidade');
const total = Math.min(Math.max(Number(qIdx >= 0 ? args[qIdx + 1] : 30) || 30, 1), 500);
const PASSWORD = 'Teste@2026#';

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Karina', 'Lucas', 'Marina', 'Nelson', 'Olívia', 'Paulo', 'Quésia', 'Rafael', 'Sara', 'Tiago', 'Úrsula', 'Vítor', 'Wanda', 'Xavier', 'Yara', 'Zeca'];
const LAST = ['Fictício', 'Exemplo', 'Teste', 'Modelo', 'Simulado', 'Amostra', 'Ensaio', 'Demonstração'];
const SECTORS = ['01', '02', 'Secom', '10', '20', '30', '40', '50', '60', '70'];
const PRACA = ['MN', 'CB', '3SG', '2SG', '1SG', 'SO'];
const OFICIAL = ['1Ten', 'CT', 'CC', 'CF'];

// Gerador pseudoaleatório com semente: sempre os mesmos dados.
let seed = 20261014;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pickOne = (list) => list[Math.floor(rnd() * list.length)];
const iso = (d) => d.toISOString().slice(0, 10);

await connectDb();
try {
  const year = new Date().getFullYear();
  let created = 0;
  await transaction(async () => {
    for (let i = 1; i <= total; i += 1) {
      const nip = `99${String(i).padStart(6, '0')}`; // série 99xxxxxx: claramente fictícia
      if (await one('SELECT 1 FROM profiles WHERE nip_hash = ?', [blindIndex(nip)])) continue;
      const first = FIRST[(i - 1) % FIRST.length];
      const name = `${first} ${pickOne(LAST)} ${pickOne(LAST)}`;
      const category = rnd() < 0.2 ? 'oficial' : 'praca';
      const rank = pickOne(category === 'oficial' ? OFICIAL : PRACA);
      const sector = pickOne(SECTORS);
      const id = newId();
      const email = `ficticio${i}@homologacao.invalid`;
      await setAuthPassword(id, email, PASSWORD);
      await upsertRow('profiles', {
        id, name, email, nip, role: 'user', war_name: first.toUpperCase(), category, rank, sector,
      });
      // Duas parcelas de 15 dias em meses diferentes.
      const parcels = [0, 1].map(k => {
        const start = new Date(Date.UTC(year + 1, Math.floor(rnd() * 6) + k * 6, 1 + Math.floor(rnd() * 14)));
        const end = new Date(start.getTime() + 14 * 86400_000);
        return { id: newId(), startDate: iso(start), endDate: iso(end), days: 15 };
      });
      await upsertRow('employees', {
        id: newId(), user_id: id, name, war_name: first.toUpperCase(), nip, sector, category, rank,
        planning_year: year, total_vacation_days: 30, vacation_parcels: parcels,
      });
      created += 1;
    }
  });
  console.log(`${created} militar(es) fictício(s) criado(s) (NIP 99000001 em diante). Senha de todos: ${PASSWORD}`);
} finally {
  await closeDb({ stopEmbedded: 'if-started' });
}
