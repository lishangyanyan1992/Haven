#!/bin/bash
# Daily Reddit comment monitoring cron script
# Re-fetches comments for stories imported with monitoring=true flag
# Updates comments in Supabase, removes flag when story is mature
set -e

export HOME=/Users/shangyanyanli
HAVEN_ROOT="$HOME/Desktop/Haven"
OUTPUT_DIR="/tmp/daily-reddit-import"
LOG_FILE="$OUTPUT_DIR/monitor.log"
SUMMARY_FILE="$OUTPUT_DIR/monitor_summary.txt"

mkdir -p "$OUTPUT_DIR"

# Load environment variables
set -a
source "$HAVEN_ROOT/.env.local"
set +a

# Run monitoring in background — nohup ensures it survives script exit
cd "$HAVEN_ROOT"
nohup python3 scripts/community/monitor-reddit-comments.py \
  --output-dir "$OUTPUT_DIR" \
  > "$LOG_FILE" 2>&1 &

MONITOR_PID=$!
echo "$MONITOR_PID" > "$OUTPUT_DIR/monitor.pid"
echo "Monitor launched (PID $MONITOR_PID) at $(date)"
echo "Log: $LOG_FILE"
echo "Summary will be at: $SUMMARY_FILE"