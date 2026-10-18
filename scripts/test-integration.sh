#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! psql -h 127.0.0.1 -p 55432 -U obra_local -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='obra_control_test'" | rg -q 1; then
 createdb -h 127.0.0.1 -p 55432 -U obra_local obra_control_test
fi
export DATABASE_URL='postgresql://obra_local@127.0.0.1:55432/obra_control_test?schema=public'
npx prisma migrate deploy
npx tsx --test tests/integration.ts
