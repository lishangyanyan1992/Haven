#!/bin/bash
# Daily Reddit import cron script — launches pipeline in background, writes summary
# This script runs fast (<5s) — the pipeline continues after this script exits
set -e

export HOME=/Users/shangyanyanli
HAVEN_ROOT="$HOME/Desktop/Haven"
OUTPUT_DIR="/tmp/daily-reddit-import"
LOG_FILE="$OUTPUT_DIR/cron.log"
SUMMARY_FILE="$OUTPUT_DIR/daily_summary.txt"

# Clean previous run
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Load environment variables
set -a
source "$HAVEN_ROOT/.env.local"
set +a

# Launch pipeline in background — nohup ensures it survives script exit
#
# The summariser is chained onto the end of the import rather than appended after
# it, because the import is backgrounded and this script exits in under five
# seconds. Appended, it would run before there was anything new to summarise.
#
# It has to run at all because the Advisor's semantic search reads
# community_advice_summaries, not community_posts. A story that is imported but
# not summarised is invisible to every question — which is the state the whole
# table was in until 2026-08-19, when 147 summaries were built for 225 existing
# posts. Skipping this step quietly recreates that gap one day at a time.
#
# `;` rather than `&&`: the summariser should still run over anything already
# imported even if the import itself failed partway. It skips posts that already
# have a summary, so a re-run is cheap and safe.
cd "$HAVEN_ROOT"
nohup bash -c '
  python3 scripts/community/daily-reddit-import.py \
    --max-stories 10 \
    --max-fetch 12 \
    --hours 336 \
    --output-dir "'"$OUTPUT_DIR"'"

  echo ""
  echo "=== Building advice summaries for the Advisor semantic search ==="
  cd "'"$HAVEN_ROOT"'/apps/haven" && npm run --silent community:summaries
' > "$LOG_FILE" 2>&1 &

PIPELINE_PID=$!
echo "$PIPELINE_PID" > "$OUTPUT_DIR/pipeline.pid"
echo "Pipeline launched (PID $PIPELINE_PID) at $(date)"
echo "Log: $LOG_FILE"
echo "Summary will be at: $SUMMARY_FILE"
echo "Advice summaries are built at the end of the same log."