#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$ROOT/scripts/supabase-cli.sh"

if [ -f "$ROOT/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  exec "$CLI" db push --db-url "$SUPABASE_DB_URL" --include-all "$@"
fi

project_ref="${SUPABASE_PROJECT_REF:-}"
if [ -z "$project_ref" ] && [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
  project_ref="$(printf '%s' "$NEXT_PUBLIC_SUPABASE_URL" | sed -E 's#https?://([^.]+)\..*#\1#')"
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] || [ -z "${SUPABASE_DB_PASSWORD:-}" ] || [ -z "$project_ref" ]; then
  cat >&2 <<'EOF'
Unable to push migrations.

Provide one of these setups:
1. SUPABASE_DB_URL
2. SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD + SUPABASE_PROJECT_REF

SUPABASE_PROJECT_REF can usually be derived from NEXT_PUBLIC_SUPABASE_URL, so you may not need to set it explicitly.
EOF
  exit 1
fi

"$CLI" link --project-ref "$project_ref" --password "$SUPABASE_DB_PASSWORD"
exec "$CLI" db push --linked --include-all "$@"
