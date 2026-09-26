#!/usr/bin/env bash
# Aplica la réplica mínima de Supabase, todas las migraciones en orden y las pruebas.
# Requiere una base de datos PostgreSQL vacía y variables PG* (PGHOST, PGUSER, PGDATABASE...).
#
# Con SIN_PERMISOS_POR_DEFECTO=1 se simula un proyecto creado sin "Automatically expose new
# tables" (como el proyecto real de FoodApp): las tablas nuevas no reciben permisos por defecto.
set -euo pipefail
cd "$(dirname "$0")/.."
stub=pruebas/00_stub_supabase.sql
if [ "${SIN_PERMISOS_POR_DEFECTO:-0}" = "1" ]; then
  stub=$(mktemp)
  grep -v '^ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT' pruebas/00_stub_supabase.sql > "$stub"
fi
archivos=("$stub")
for m in migrations/*.sql; do archivos+=("$m"); done
for p in pruebas/[0-9][1-9]_*.sql; do archivos+=("$p"); done
args=()
for f in "${archivos[@]}"; do args+=(-f "$f"); done
psql -v ON_ERROR_STOP=1 -q "${args[@]}"
