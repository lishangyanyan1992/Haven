#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$ROOT/node_modules/.bin/supabase"

if [ -f "$ROOT/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

if [ ! -x "$CLI" ]; then
  echo "Supabase CLI is not installed. Run the project install step first." >&2
  exit 1
fi

exec "$CLI" --workdir "$ROOT" "$@"
