#!/usr/bin/env bash
# Teste schema.sql + scénarios sur un PostgreSQL LOCAL jetable (jamais sur la production).
# Usage : PGHOST=/tmp PGPORT=5544 PGUSER=postgres ./tests/run_db_tests.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=ripu26_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
for r in anon authenticated service_role; do psql -q -d postgres -c "do \$\$ begin create role $r; exception when duplicate_object then null; end \$\$"; done
# Reproduit les droits Supabase du rôle service_role
psql -q -d postgres -c "alter role service_role bypassrls"
psql -q -d $DB -v ON_ERROR_STOP=1 -f database/schema.sql >/dev/null
psql -q -d $DB -c "grant all on all tables in schema public to service_role"
psql -q -d $DB -v ON_ERROR_STOP=1 -f tests/db_scenarios.sql
