#!/bin/bash
# Daily Reddit import cron script
# Runs the full pipeline: discover -> fetch -> score -> import -> summary
# Output (stdout) is delivered as the cron message
set -e

export HOME=/Users/shangyanyanli
HAVEN_ROOT="$HOME/Desktop/Haven"

# Load environment variables
set -a
source "$HAVEN_ROOT/.env.local"
set +a

cd "$HAVEN_ROOT"

# Run the pipeline (non-dry-run, auto-publish, up to 10 stories, 24h window)
python3 scripts/community/daily-reddit-import.py \
  --max-stories 10 \
  --max-fetch 12 \
  --hours 24 \
  --output-dir /tmp/daily-reddit-import

# Print the summary as the cron output
echo ""
cat /tmp/daily-reddit-import/daily_summary.txt 2>/dev/null || echo "No summary generated"