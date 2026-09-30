#!/usr/bin/env bash
#
# TEST-1 — replay every migration onto an empty PostgreSQL.
#
#   npm run replay:migrations -- --setup  "postgresql://postgres:postgres@localhost:5432/edureach"
#   npm run replay:migrations -- --apply  "…"
#   npm run replay:migrations -- --verify "…"
#
# The three modes are separate so CI can show them as separate steps and so a
# failure names the phase (platform shims / migration application / assertions).
#
# `--apply` runs each file with ON_ERROR_STOP=1 and stops at the first failing
# statement, printing the migration filename and PostgreSQL's error. A
# migration that half-applies is exactly what this job exists to catch.
#
# See docs/features/TEST-1.md. This never touches a hosted database: CI points it
# at a postgres:16 service container, and the caller supplies the URL.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-}"
DATABASE_URL="${2:-}"

usage() {
  echo "usage: $(basename "$0") --setup|--apply|--verify <database-url>" >&2
}

if [[ -z "$MODE" || -z "$DATABASE_URL" ]]; then
  usage
  exit 2
fi

psql_run() {
  psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"
}

case "$MODE" in
  --setup)
    echo "== platform shims =="
    psql_run -f "$ROOT/supabase/ci/platform-shims.sql"
    echo "ok  auth and storage surface ready"
    ;;

  --apply)
    echo "== migrations =="
    shopt -s nullglob
    applied=0
    for file in "$ROOT"/supabase/migrations/*.sql; do
      name="$(basename "$file")"
      if error="$(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -f "$file" 2>&1)"; then
        applied=$((applied + 1))
        echo "ok  $name"
      else
        echo "FAILED  $name"
        echo "$error"
        exit 1
      fi
    done
    if [[ "$applied" -eq 0 ]]; then
      echo "no migrations found under $ROOT/supabase/migrations" >&2
      exit 1
    fi
    echo "applied $applied migration(s)"
    ;;

  --verify)
    echo "== assertions =="
    psql_run -f "$ROOT/supabase/ci/verify-migrations.sql"
    ;;

  *)
    usage
    exit 2
    ;;
esac
