// Definição das tabelas do SISFERIAS (PostgreSQL).
//
// Cada coluna tem um tipo lógico usado para converter valores entre o banco,
// a API (JSON) e os arquivos de importação (CSV/JSON):
//   text  -> TEXT
//   int   -> INTEGER
//   bool  -> BOOLEAN
//   ts    -> TIMESTAMPTZ (a API devolve texto ISO 8601)
//   json  -> JSONB (a API devolve objeto/array)
//
// `encrypted` lista as colunas com dados pessoais, gravadas cifradas
// (AES-256-GCM, ver server/crypto.js) em colunas TEXT. `blind` indica as
// colunas que têm um índice cego (HMAC) para buscas por igualdade.
//
// Colunas desconhecidas encontradas em importações são guardadas em
// `extra_json`, para que nenhum dado seja descartado.

export const TABLES = {
  profiles: {
    label: 'Perfis de usuário',
    key: ['id'],
    encrypted: ['name', 'email', 'war_name', 'nip'],
    blind: { email: 'email_hash', nip: 'nip_hash' },
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
      created_at: 'ts',
      updated_at: 'ts',
    },
  },
  employees: {
    label: 'Lançamentos de férias',
    key: ['id'],
    encrypted: ['name', 'war_name', 'nip', 'photo_url', 'justification'],
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
      created_at: 'ts',
      updated_at: 'ts',
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
      privacy_officer: 'text',
      privacy_contact: 'text',
      created_at: 'ts',
      updated_at: 'ts',
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
      created_at: 'ts',
    },
  },
  audit_logs: {
    label: 'Auditoria',
    key: ['id'],
    encrypted: ['user_name', 'field', 'old_value', 'new_value'],
    columns: {
      id: 'text',
      timestamp: 'ts',
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
    encrypted: ['user_name', 'war_name'],
    columns: {
      id: 'text',
      user_id: 'text',
      user_name: 'text',
      war_name: 'text',
      title: 'text',
      description: 'text',
      created_at: 'ts',
    },
  },
  print_preferences: {
    label: 'Preferências de impressão',
    key: ['user_id'],
    encrypted: ['phone', 'address', 'observations'],
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
      created_at: 'ts',
      updated_at: 'ts',
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

// Colunas cifradas são TEXT; as demais usam os tipos nativos do PostgreSQL.
const SCHEMA_V1 = `
CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_hash TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  elevated_until TIMESTAMPTZ
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  email_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  view_all_sectors BOOLEAN NOT NULL DEFAULT FALSE,
  war_name TEXT DEFAULT '',
  nip TEXT DEFAULT '',
  nip_hash TEXT,
  category TEXT DEFAULT '',
  sector TEXT DEFAULT '',
  rank TEXT DEFAULT '',
  extra_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX profiles_nip_hash_idx ON profiles(nip_hash);
CREATE INDEX profiles_email_hash_idx ON profiles(email_hash);

CREATE TABLE employees (
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
  vacation_parcels JSONB NOT NULL DEFAULT '[]',
  photo_url TEXT,
  justification TEXT,
  extra_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, planning_year)
);
CREATE INDEX employees_sector_idx ON employees(sector);

CREATE TABLE system_settings (
  id INTEGER PRIMARY KEY,
  institution_name TEXT DEFAULT 'MARINHA DO BRASIL',
  total_manpower INTEGER DEFAULT 100,
  logo_url TEXT,
  staff_json JSONB NOT NULL DEFAULT '{}',
  vacation_deadline TEXT,
  deadline_applied_for TEXT,
  backup_copy_dir TEXT,
  backup_copy_status JSONB,
  extra_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  extra_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_name TEXT DEFAULT '',
  action TEXT DEFAULT '',
  field TEXT DEFAULT '',
  old_value TEXT DEFAULT '',
  new_value TEXT DEFAULT '',
  extra_json JSONB
);
CREATE INDEX audit_logs_timestamp_idx ON audit_logs(timestamp DESC);

CREATE TABLE suggestions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT NOT NULL DEFAULT '',
  war_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  extra_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX suggestions_created_at_idx ON suggestions(created_at DESC);

CREATE TABLE print_preferences (
  user_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '{}',
  encarregado JSONB NOT NULL DEFAULT '{}',
  encarregado_dep JSONB NOT NULL DEFAULT '{}',
  vice_diretor JSONB NOT NULL DEFAULT '{}',
  diretor JSONB NOT NULL DEFAULT '{}',
  observations TEXT NOT NULL DEFAULT '',
  ship TEXT NOT NULL DEFAULT 'CENTRO DE OPERACOES DO ABASTECIMENTO',
  specialization TEXT NOT NULL DEFAULT 'PL',
  lic_time TEXT NOT NULL DEFAULT '16:10',
  apr_time TEXT NOT NULL DEFAULT '07:30',
  is_desmuniciado TEXT NOT NULL DEFAULT 'sim',
  extra_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registro de todas as operações feitas por meio do sistema
-- (DCTIMARINST 30-17, item 4.4). O usuário da aplicação só pode inserir e
-- consultar: não consegue alterar nem apagar registros.
CREATE TABLE operation_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id TEXT,
  user_label TEXT,
  ip TEXT,
  method TEXT NOT NULL,
  route TEXT NOT NULL,
  status INTEGER,
  operation TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX operation_log_at_idx ON operation_log(at DESC);
CREATE INDEX operation_log_user_idx ON operation_log(user_id);
`;

// Migrações versionadas. Para evoluir o banco, acrescente um item novo ao
// final; nunca altere um item já publicado.
export const MIGRATIONS = [
  { version: 1, name: 'esquema inicial (PostgreSQL)', sql: SCHEMA_V1 },
  {
    version: 2,
    name: 'Encarregado de dados (LGPD) configurável',
    sql: `ALTER TABLE system_settings
      ADD COLUMN IF NOT EXISTS privacy_officer TEXT,
      ADD COLUMN IF NOT EXISTS privacy_contact TEXT;`,
  },
];

// Tabelas em que o usuário da aplicação só insere e consulta (trilha de auditoria).
export const APPEND_ONLY_TABLES = ['audit_logs', 'operation_log'];
