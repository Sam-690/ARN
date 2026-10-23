#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
DB_DIR="$PWD/.local/postgres"
mkdir -p "$PWD/.local"

case "${1:-start}" in
  start)
    if [ ! -f "$DB_DIR/PG_VERSION" ]; then
      initdb -D "$DB_DIR" -U obra_local --auth-local=trust --auth-host=trust \
        > "$PWD/.local/initdb.log"
      printf "\nlisten_addresses = '127.0.0.1'\nport = 55432\nunix_socket_directories = '%s'\n" \
        "$PWD/.local" >> "$DB_DIR/postgresql.conf"
    fi

    if ! pg_ctl -D "$DB_DIR" status >/dev/null 2>&1; then
      pg_ctl -D "$DB_DIR" -l "$PWD/.local/postgres.log" start
    fi

    if ! psql -h 127.0.0.1 -p 55432 -U obra_local -d postgres \
      -tAc "SELECT 1 FROM pg_database WHERE datname='obra_control'" | rg -q 1; then
      createdb -h 127.0.0.1 -p 55432 -U obra_local obra_control
    fi
    ;;
  stop)
    pg_ctl -D "$DB_DIR" stop
    ;;
  *)
    echo 'Uso: db-local.sh start|stop'
    exit 1
    ;;
esac
