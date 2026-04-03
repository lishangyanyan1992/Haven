#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$ROOT/scripts/supabase-cli.sh"
OUT_FILE="$ROOT/src/types/database.ts"

if [ -f "$ROOT/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  exec "$CLI" gen types typescript --db-url "$SUPABASE_DB_URL" --schema public > "$OUT_FILE"
fi

project_ref="${SUPABASE_PROJECT_REF:-}"
if [ -z "$project_ref" ] && [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
  project_ref="$(printf '%s' "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's#https?://([^.]+)\..*#\1#')"
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] || [ -z "$project_ref" ]; then
  cat >&2 <<'EOF'
Unable to generate database types.

Provide one of these setups:
1. SUPABASE_DB_URL
2. SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF

SUPABASE_PROJECT_REF can usually be derived from NEXT_PUBLIC_SUPABASE_URL, so you may not need to set it explicitly.
EOF
  exit 1
fi

exec "$CLI" gen types typescript --project-id "$project_ref" --schema public > "$OUT_FILE"
