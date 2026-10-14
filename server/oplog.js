// Registro de operações (DCTIMARINST 30-17, item 4.4): cada operação feita
// por meio do sistema é gravada em operation_log — quem, quando, de qual
// computador, o quê e com qual resultado —, inclusive as de usuários
// autorizados e as tentativas recusadas.
//
// - Toda gravação, exclusão, login, logout, exportação e download é registrada.
// - Consultas (GET) também, mas a mesma consulta do mesmo usuário é registrada
//   no máximo uma vez por hora (as telas se atualizam sozinhas a cada minuto).
// - Usuário, IP e detalhes ficam cifrados; o usuário de banco da aplicação
//   não consegue alterar nem apagar registros (ver grantAppPrivileges).
import { run } from './db.js';
import { encrypt } from './crypto.js';

const OPERATIONS = {
  'POST /auth/login': 'Login',
  'POST /auth/logout': 'Logout',
  'POST /auth/register': 'Cadastro de conta',
  'POST /auth/password': 'Troca de senha',
  'POST /auth/elevate': 'Acesso à área de Segurança',
  'POST /auth/elevate/end': 'Saída da área de Segurança',
  'GET /profiles': 'Consulta de usuários',
  'GET /profiles/:id': 'Consulta de usuário',
  'PATCH /profiles/:id': 'Alteração de usuário',
  'DELETE /profiles/:id': 'Exclusão de usuário',
  'POST /profiles/block-all': 'Bloqueio/liberação geral de lançamentos',
  'POST /admin/reset-password': 'Redefinição de senha',
  'GET /employees': 'Consulta de lançamentos',
  'POST /employees': 'Gravação de lançamento',
  'PATCH /employees/:id': 'Alteração de lançamento',
  'DELETE /employees/:id': 'Exclusão de lançamento',
  'GET /settings': 'Consulta de configurações',
  'PUT /settings': 'Alteração de configurações',
  'PUT /settings/deadline': 'Alteração do prazo final',
  'GET /notices': 'Consulta de avisos',
  'POST /notices': 'Criação de aviso',
  'PATCH /notices/:id': 'Alteração de aviso',
  'DELETE /notices/:id': 'Exclusão de aviso',
  'GET /audit-logs': 'Consulta da auditoria',
  'POST /audit-logs': 'Registro de auditoria',
  'GET /suggestions': 'Consulta de sugestões',
  'POST /suggestions': 'Envio de sugestão',
  'DELETE /suggestions/:id': 'Exclusão de sugestão',
  'GET /print-preferences/:userId': 'Consulta de dados da papeleta',
  'PUT /print-preferences/:userId': 'Gravação de dados da papeleta',
  'GET /admin/stats': 'Consulta de dados do sistema',
  'POST /admin/import/preview': 'Pré-visualização de importação',
  'POST /admin/import/apply': 'Importação de dados',
  'GET /admin/export': 'Exportação completa de dados',
  'GET /admin/export/:table': 'Exportação de tabela (CSV)',
  'PUT /admin/backup-copy': 'Pasta de cópia dos backups',
  'GET /admin/backups': 'Consulta de backups',
  'POST /admin/backups': 'Criação de backup',
  'GET /admin/backups/:file': 'Download de backup',
  'GET /admin/operations': 'Consulta do registro de operações',
  'GET /certificado': 'Download do certificado',
};

// Rotas técnicas, sem acesso a dados, que não precisam de registro.
const SKIP = new Set(['/health', '/ambiente', '/privacidade', '/auth/me', '/auth/elevation']);

const GET_INTERVAL_MS = 60 * 60_000;
const lastGet = new Map();

function shouldLogGet(key) {
  const now = Date.now();
  const last = lastGet.get(key);
  if (last && now - last < GET_INTERVAL_MS) return false;
  lastGet.set(key, now);
  if (lastGet.size > 20_000) {
    for (const [k, t] of lastGet) if (now - t >= GET_INTERVAL_MS) lastGet.delete(k);
  }
  return true;
}

export function operationLogger(req, res, next) {
  if (SKIP.has(req.path)) return next();
  res.on('finish', () => {
    // Rota reconhecida; se a requisição foi recusada antes (ex.: sem login ou com
    // senha provisória), tenta o nome pelo caminho exato.
    const pattern = req.route?.path ? `${req.method} ${req.route.path}`
      : OPERATIONS[`${req.method} ${req.path}`] ? `${req.method} ${req.path}` : null;
    const user = res.locals.opUser || (req.user ? { id: req.user.id, label: req.user.name } : null);
    if (req.method === 'GET' && res.statusCode < 400 && !shouldLogGet(`${user?.id}|${req.path}`)) return;
    const detail = [res.locals.opDetail, req.route?.path && req.path !== req.route.path ? req.path : null].filter(Boolean).join(' — ');
    run(`INSERT INTO operation_log (user_id, user_label, ip, method, route, status, operation, detail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      user?.id || null,
      user?.label ? encrypt(user.label) : null,
      req.ip ? encrypt(req.ip) : null,
      req.method,
      pattern ? pattern.slice(req.method.length + 1) : req.path,
      res.statusCode,
      OPERATIONS[pattern] || `${req.method} ${req.path}`,
      detail ? encrypt(detail) : null,
    ]).catch(err => console.error('[registro] falha ao registrar operação:', err.message));
  });
  next();
}
