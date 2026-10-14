#!/bin/sh
# Executado uma única vez, na criação do banco do contêiner PostgreSQL:
# cria o usuário da APLICAÇÃO (só lê/grava dados). O dono do banco
# (POSTGRES_USER) é usado pelo SISFERIAS apenas nas migrações.
# DCTIMARINST 30-17, item 4.1: privilégio mínimo.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
CREATE ROLE sisferias_app LOGIN PASSWORD '${SISFERIAS_APP_SENHA}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
REVOKE ALL ON DATABASE "${POSTGRES_DB}" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE "${POSTGRES_DB}" TO sisferias_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO sisferias_app;
EOSQL
