#!/bin/bash
set -euo pipefail

ROOT="/Users/shangyanyanli/Desktop/Haven"
FALLBACK_NODE="/tmp/node-v22.14.0-darwin-arm64/bin/node"
FALLBACK_BIN_DIR="/tmp/node-v22.14.0-darwin-arm64/bin"

cd "$ROOT"

if command -v node >/dev/null 2>&1; then
  exec node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000
fi

if [ -x "$FALLBACK_NODE" ]; then
  export PATH="$FALLBACK_BIN_DIR:$PATH"
  exec "$FALLBACK_NODE" node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000
fi

echo "Node.js was not found on PATH and no fallback binary exists at $FALLBACK_NODE." >&2
echo "Install Node.js or place the fallback runtime there, then rerun ./dev.sh." >&2
exit 1
