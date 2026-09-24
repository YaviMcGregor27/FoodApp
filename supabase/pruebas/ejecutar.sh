#!/usr/bin/env bash
# Aplica la réplica mínima de Supabase, todas las migraciones en orden y las pruebas.
# Requiere una base de datos PostgreSQL 16 vacía y variables PG* (PGHOST, PGUSER, PGDATABASE...).
set -euo pipefail
cd "$(dirname "$0")/.."
archivos=(pruebas/00_stub_supabase.sql)
for m in migrations/*.sql; do archivos+=("$m"); done
for p in pruebas/[0-9][1-9]_*.sql; do archivos+=("$p"); done
args=()
for f in "${archivos[@]}"; do args+=(-f "$f"); done
psql -v ON_ERROR_STOP=1 -q "${args[@]}"
