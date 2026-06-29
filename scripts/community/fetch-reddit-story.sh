#!/usr/bin/env bash
#
# fetch-reddit-story.sh — Retrieve a Reddit post + its comments as structured JSON
#
# Usage:
#   ./fetch-reddit-story.sh <subreddit> <post_id>
#
# Examples:
#   ./fetch-reddit-story.sh h1b 1uivv8k
#   ./fetch-reddit-story.sh immigration 1abc123
#
# Output:
#   /tmp/reddit_story_<post_id>.json  — structured JSON with post + comments
#   /tmp/reddit_subfeed_<subreddit>.xml — raw RSS feed (if fetched)
#
# Methodology (discovered 2026-06-29):
#   Reddit blocks most programmatic access:
#     - JSON API (.json endpoints) → returns HTML JS-challenge page
#     - Browser navigation → "blocked by network security"
#     - Redlib mirrors → 403 or behind Anubis JS challenge
#     - curl -s (silent) → 0 bytes (rate-limited)
#
#   What WORKS: the .rss endpoint with retries + delays between attempts.
#   Reddit intermittently rate-limits even this, so we retry up to N times
#   with a configurable delay. The verbose flag (curl -v) is NOT needed —
#   curl -s works fine once the rate-limit window passes.
#
#   RSS feeds contain:
#     - Original post (title + selftext as HTML)
#     - Top-level comments ONLY (nested replies are NOT included)
#     - Each entry has: <id>, <title>, <author><name>, <updated>, <content type="html">
#     - Post IDs start with t3_, comment IDs start with t1_
#
#   Known limitations:
#     - No nested comment replies (only top-level comments visible)
#     - Rate-limited — requires retries with delays (10-15s between attempts)
#     - Fresh posts may have few or no comments yet
#     - RSS only returns the most recent ~25 entries per feed
#
set -euo pipefail

SUBREDDIT="${1:?Usage: fetch-reddit-story.sh <subreddit> <post_id>}"
POST_ID="${2:?Usage: fetch-reddit-story.sh <subreddit> <post_id>}"

# Config
MAX_RETRIES=15      # max fetch attempts per endpoint
DELAY=12           # seconds between retries
UA="Haven/1.0 (Immigration Planning Platform)"  # user agent

OUTPUT_DIR="/tmp"
RAW_XML="${OUTPUT_DIR}/reddit_comments_${POST_ID}.xml"
OUTPUT_JSON="${OUTPUT_DIR}/reddit_story_${POST_ID}.json"

echo "============================================"
echo " fetch-reddit-story.sh"
echo " Subreddit: r/$SUBREDDIT"
echo " Post ID:   $POST_ID"
echo "============================================"
echo ""

# ─────────────────────────────────────────────
# STEP 1: Fetch the comments RSS feed
# ─────────────────────────────────────────────
echo "[1/3] Fetching comments RSS feed..."
echo "      URL: https://www.reddit.com/r/$SUBREDDIT/comments/$POST_ID/.rss"

SUCCESS=0
for i in $(seq 1 $MAX_RETRIES); do
  # Fetch directly into the output file in a SINGLE curl call
  # (calling curl twice in a row triggers rate-limiting on the 2nd call)
  curl -s \
    -H "User-Agent: $UA" \
    -H "Accept: application/atom+xml" \
    "https://www.reddit.com/r/$SUBREDDIT/comments/$POST_ID/.rss" \
    > "$RAW_XML"

  SAVED_SIZE=$(wc -c < "$RAW_XML" | tr -d ' ')

  if [ "$SAVED_SIZE" -gt 1000 ]; then
    echo "      Attempt $i: $SAVED_SIZE bytes — SUCCESS"
    echo "      Saved to $RAW_XML"
    SUCCESS=1
    break
  else
    echo "      Attempt $i: $SAVED_SIZE bytes (rate-limited)"
    # Remove the empty/failed file
    rm -f "$RAW_XML"
    sleep $DELAY
  fi
done

if [ "$SUCCESS" -eq 0 ]; then
  echo ""
  echo "ERROR: Failed to fetch comments RSS after $MAX_RETRIES attempts."
  echo "       Reddit may be heavily rate-limiting this IP."
  echo "       Try again later or from a different IP."
  exit 1
fi

# ─────────────────────────────────────────────
# STEP 2: Also fetch the subreddit feed for context (optional)
# ─────────────────────────────────────────────
SUBFEED_XML="${OUTPUT_DIR}/reddit_subfeed_${SUBREDDIT}.xml"
echo ""
echo "[2/3] Fetching r/$SUBREDDIT new feed (optional, for discovering posts)..."

for i in $(seq 1 5); do
  curl -s \
    -H "User-Agent: $UA" \
    -H "Accept: application/atom+xml" \
    "https://www.reddit.com/r/$SUBREDDIT/new/.rss" \
    > "$SUBFEED_XML"
  SAVED_SIZE=$(wc -c < "$SUBFEED_XML" | tr -d ' ')
  if [ "$SAVED_SIZE" -gt 1000 ]; then
    echo "      Got subreddit feed ($SAVED_SIZE bytes) — saved to $SUBFEED_XML"
    break
  else
    echo "      Attempt $i: $SAVED_SIZE bytes (rate-limited)"
    rm -f "$SUBFEED_XML"
  fi
  sleep $DELAY
done

# ─────────────────────────────────────────────
# STEP 3: Parse the RSS XML into structured JSON
# ─────────────────────────────────────────────
echo ""
echo "[3/3] Parsing RSS into structured JSON..."

python3 - "$RAW_XML" "$OUTPUT_JSON" << 'PYEOF'
import re
import html
import json
import sys
from datetime import datetime

raw_path = sys.argv[1]
out_path = sys.argv[2]

with open(raw_path) as f:
    xml = f.read()

# Fix escaped quotes that Reddit sometimes injects
xml = xml.replace('\\"', '"')

# Extract all entries
entries_raw = re.findall(r'<entry>(.*?)</entry>', xml, re.DOTALL)

post = None
comments = []

for entry in entries_raw:
    id_m = re.search(r'<id>(.*?)</id>', entry)
    title_m = re.search(r'<title>(.*?)</title>', entry)
    author_m = re.search(r'<name>(.*?)</name>', entry)
    updated_m = re.search(r'<updated>(.*?)</updated>', entry)
    content_m = re.search(r'<content type="html">(.*?)</content>', entry, re.DOTALL)

    entry_id = id_m.group(1) if id_m else ""
    title = html.unescape(title_m.group(1)) if title_m else ""
    author = author_m.group(1) if author_m else ""
    updated = updated_m.group(1) if updated_m else ""
    
    # Clean content
    content_html = content_m.group(1) if content_m else ""
    content_html = html.unescape(content_html)
    # Remove Reddit's SC_OFF/SC_ON markers
    content_html = content_html.replace('<!-- SC_OFF -->', '').replace('<!-- SC_ON -->', '')
    # Strip HTML tags for plain text
    content_text = re.sub(r'<[^>]+>', '', content_html)
    content_text = re.sub(r'\s+', ' ', content_text).strip()

    if entry_id.startswith('t3_'):
        # Original post
        post = {
            "id": entry_id,
            "reddit_id": entry_id.replace('t3_', ''),
            "title": title,
            "author": author,
            "published": updated,
            "url": f"https://www.reddit.com{entry_id.replace('t3_', '/r/')}",
            "selftext": content_text,
            "selftext_html": content_html.strip(),
        }
    elif entry_id.startswith('t1_'):
        # Comment
        comments.append({
            "id": entry_id,
            "author": author,
            "published": updated,
            "body": content_text,
            "body_html": content_html.strip(),
        })

result = {
    "post": post,
    "comments": comments,
    "comment_count": len(comments),
    "fetched_at": datetime.utcnow().isoformat() + "Z",
    "source_url": f"https://www.reddit.com/r/{post['reddit_id']}/comments/{post['reddit_id']}" if post else "",
    "method": "Reddit RSS feed (.rss endpoint) with retry logic — JSON API and browser are blocked by Reddit bot detection",
    "limitations": [
        "Only top-level comments are included (no nested replies)",
        "RSS feed may be rate-limited — requires retries with delays",
        "Fresh posts may have few or no comments",
    ],
}

with open(out_path, 'w') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)

print(f"  Parsed {len(entries_raw)} entries:")
print(f"    Post: {'YES' if post else 'NO'}")
print(f"    Comments: {len(comments)}")
print(f"  Output: {out_path}")
PYEOF

echo ""
echo "============================================"
echo " DONE"
echo "============================================"
echo " Output:   $OUTPUT_JSON"
echo " Raw XML:  $RAW_XML"
if [ -f "$SUBFEED_XML" ]; then
  echo " SubFeed:  $SUBFEED_XML"
fi
echo ""
echo " To view the parsed JSON:"
echo "   python3 -m json.tool $OUTPUT_JSON | head -60"
echo ""
echo " To use in the Haven import pipeline:"
echo "   python3 -c \"import json; d=json.load(open('$OUTPUT_JSON')); print(d['post']['title'])\""