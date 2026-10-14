// Definição das tabelas do SISFERIAS.
//
// Cada coluna tem um tipo lógico usado para converter valores entre o banco
// (SQLite), a API (JSON) e os arquivos de importação (CSV/JSON):
//   text  -> TEXT
//   int   -> INTEGER
//   real  -> REAL
//   bool  -> INTEGER 0/1 (API devolve true/false)
//   json  -> TEXT com JSON (API devolve objeto/array)
//
// Colunas desconhecidas encontradas em importações são guardadas em
// `extra_json`, para que nenhum dado seja descartado.

export const TABLES = {
  profiles: {
    label: 'Perfis de usuário',
    key: ['id'],
    columns: {
      id: 'text',
      name: 'text',
      email: 'text',
      role: 'text',
      is_blocked: 'bool',
      view_all_sectors: 'bool',
      war_name: 'text',
      nip: 'text',
      category: 'text',
      sector: 'text',
      rank: 'text',
      created_at: 'text',
      updated_at: 'text',
    },
  },
  employees: {
    label: 'Lançamentos de férias',
    key: ['id'],
    columns: {
      id: 'text',
      user_id: 'text',
      name: 'text',
      war_name: 'text',
      nip: 'text',
      sector: 'text',
      category: 'text',
      rank: 'text',
      planning_year: 'int',
      total_vacation_days: 'int',
      vacation_parcels: 'json',
      photo_url: 'text',
      justification: 'text',
      created_at: 'text',
      updated_at: 'text',
    },
  },
  system_settings: {
    label: 'Configurações do sistema',
    key: ['id'],
    columns: {
      id: 'int',
      institution_name: 'text',
      total_manpower: 'int',
      logo_url: 'text',
      staff_json: 'json',
      vacation_deadline: 'text',
      deadline_applied_for: 'text',
      backup_copy_dir: 'text',
      backup_copy_status: 'json',
      created_at: 'text',
      updated_at: 'text',
    },
  },
  notices: {
    label: 'Avisos',
    key: ['id'],
    columns: {
      id: 'text',
      title: 'text',
      content: 'text',
      is_pinned: 'bool',
      created_at: 'text',
    },
  },
  audit_logs: {
    label: 'Auditoria',
    key: ['id'],
    columns: {
      id: 'text',
      timestamp: 'text',
      user_name: 'text',
      action: 'text',
      field: 'text',
      old_value: 'text',
      new_value: 'text',
    },
  },
  suggestions: {
    label: 'Sugestões',
    key: ['id'],
    columns: {
      id: 'text',
      user_id: 'text',
      user_name: 'text',
      war_name: 'text',
      title: 'text',
      description: 'text',
      created_at: 'text',
    },
  },
  print_preferences: {
    label: 'Preferências de impressão',
    key: ['user_id'],
    columns: {
      user_id: 'text',
      phone: 'text',
      address: 'json',
      encarregado: 'json',
      encarregado_dep: 'json',
      vice_diretor: 'json',
      diretor: 'json',
      observations: 'text',
      ship: 'text',
      specialization: 'text',
      lic_time: 'text',
      apr_time: 'text',
      is_desmuniciado: 'text',
      created_at: 'text',
      updated_at: 'text',
    },
  },
};

// Ordem de importação/exportação (perfis antes dos registros que apontam para eles).
export const TABLE_ORDER = [
  'profiles',
  'system_settings',
  'employees',
  'notices',
  'audit_logs',
  'suggestions',
  'print_preferences',
];

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  is_blocked INTEGER NOT NULL DEFAULT 0,
  view_all_sectors INTEGER NOT NULL DEFAULT 0,
  war_name TEXT DEFAULT '',
  nip TEXT DEFAULT '',
  category TEXT DEFAULT '',
  sector TEXT DEFAULT '',
  rank TEXT DEFAULT '',
  extra_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS profiles_nip_idx ON profiles(nip);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT DEFAULT '',
  war_name TEXT DEFAULT '',
  nip TEXT DEFAULT '',
  sector TEXT DEFAULT '',
  category TEXT DEFAULT '',
  rank TEXT DEFAULT '',
  planning_year INTEGER,
  total_vacation_days INTEGER DEFAULT 30,
  vacation_parcels TEXT NOT NULL DEFAULT '[]',
  photo_url TEXT,
  justification TEXT,
  extra_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, planning_year)
);
CREATE INDEX IF NOT EXISTS employees_sector_idx ON employees(sector);

CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY,
  institution_name TEXT DEFAULT 'MARINHA DO BRASIL',
  total_manpower INTEGER DEFAULT 100,
  logo_url TEXT,
  staff_json TEXT NOT NULL DEFAULT '{}',
  extra_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  is_pinned INTEGER NOT NULL DEFAULT 0,
  extra_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  user_name TEXT DEFAULT '',
  action TEXT DEFAULT '',
  field TEXT DEFAULT '',
  old_value TEXT DEFAULT '',
  new_value TEXT DEFAULT '',
  extra_json TEXT
);
CREATE INDEX IF NOT EXISTS audit_logs_timestamp_idx ON audit_logs(timestamp DESC);

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT NOT NULL DEFAULT '',
  war_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  extra_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS suggestions_created_at_idx ON suggestions(created_at DESC);

CREATE TABLE IF NOT EXISTS print_preferences (
  user_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '{}',
  encarregado TEXT NOT NULL DEFAULT '{}',
  encarregado_dep TEXT NOT NULL DEFAULT '{}',
  vice_diretor TEXT NOT NULL DEFAULT '{}',
  diretor TEXT NOT NULL DEFAULT '{}',
  observations TEXT NOT NULL DEFAULT '',
  ship TEXT NOT NULL DEFAULT 'CENTRO DE OPERACOES DO ABASTECIMENTO',
  specialization TEXT NOT NULL DEFAULT 'PL',
  lic_time TEXT NOT NULL DEFAULT '16:10',
  apr_time TEXT NOT NULL DEFAULT '07:30',
  is_desmuniciado TEXT NOT NULL DEFAULT 'sim',
  extra_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

// Migrações versionadas. Para evoluir o banco, acrescente um item novo ao
// final; nunca altere um item já publicado.
export const MIGRATIONS = [
  { version: 1, name: 'esquema inicial', sql: SCHEMA_V1 },
  {
    version: 2,
    name: 'confirmação de senha para a área de Segurança',
    sql: 'ALTER TABLE sessions ADD COLUMN elevated_until TEXT;',
  },
  {
    version: 3,
    name: 'prazo final de lançamento controlado pelo servidor',
    sql: `ALTER TABLE system_settings ADD COLUMN vacation_deadline TEXT;
          ALTER TABLE system_settings ADD COLUMN deadline_applied_for TEXT;`,
  },
  {
    version: 4,
    name: 'cópia dos backups para outra pasta',
    sql: `ALTER TABLE system_settings ADD COLUMN backup_copy_dir TEXT;
          ALTER TABLE system_settings ADD COLUMN backup_copy_status TEXT;`,
  },
];
