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
cd "$HAVEN_ROOT"
nohup python3 scripts/community/daily-reddit-import.py \
  --max-stories 10 \
  --max-fetch 12 \
  --hours 336 \
  --output-dir "$OUTPUT_DIR" \
  > "$LOG_FILE" 2>&1 &

PIPELINE_PID=$!
echo "$PIPELINE_PID" > "$OUTPUT_DIR/pipeline.pid"
echo "Pipeline launched (PID $PIPELINE_PID) at $(date)"
echo "Log: $LOG_FILE"
echo "Summary will be at: $SUMMARY_FILE"