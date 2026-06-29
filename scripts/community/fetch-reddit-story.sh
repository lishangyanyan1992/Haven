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

# ---------------------------------------------------------------------------
# Langfuse tracing (optional — silently skipped if env vars not set)
# ---------------------------------------------------------------------------

LANGFUSE_TRACE_ID=""
if [ -n "${LANGFUSE_BASE_URL:-}" ] && [ -n "${LANGFUSE_STORY_PUBLIC_KEY:-}" ] && [ -n "${LANGFUSE_STORY_SECRET_KEY:-}" ]; then
  LANGFUSE_TRACE_ID=$(python3 -c "import uuid; print(uuid.uuid4())")
fi

langfuse_event() {
  # $1 = event name, $2 = JSON metadata string (optional)
  if [ -z "$LANGFUSE_TRACE_ID" ]; then return; fi
  local name="$1"
  local metadata="${2:-{}}"
  python3 - "$LANGFUSE_TRACE_ID" "$name" "$metadata" << 'PYEOF' 2>/dev/null || true
import sys, json, base64, os
from urllib.request import Request, urlopen

trace_id, name, metadata = sys.argv[1], sys.argv[2], sys.argv[3]
base_url = os.environ["LANGFUSE_BASE_URL"].rstrip("/")
pk = os.environ["LANGFUSE_STORY_PUBLIC_KEY"]
sk = os.environ["LANGFUSE_STORY_SECRET_KEY"]
url = f"{base_url}/api/public/events"
payload = json.dumps({"traceId": trace_id, "name": name, "metadata": json.loads(metadata)})
req = Request(url, data=payload.encode(), method="POST")
req.add_header("Content-Type", "application/json")
creds = base64.b64encode(f"{pk}:{sk}".encode()).decode()
req.add_header("Authorization", f"Basic {creds}")
try:
    urlopen(req, timeout=5)
except Exception:
    pass
PYEOF
}

langfuse_score() {
  # $1 = score name, $2 = value, $3 = comment (optional)
  if [ -z "$LANGFUSE_TRACE_ID" ]; then return; fi
  local name="$1"
  local value="$2"
  local comment="${3:-}"
  python3 - "$LANGFUSE_TRACE_ID" "$name" "$value" "$comment" << 'PYEOF' 2>/dev/null || true
import sys, json, base64, os
from urllib.request import Request, urlopen

trace_id, name, value, comment = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
base_url = os.environ["LANGFUSE_BASE_URL"].rstrip("/")
pk = os.environ["LANGFUSE_STORY_PUBLIC_KEY"]
sk = os.environ["LANGFUSE_STORY_SECRET_KEY"]
url = f"{base_url}/api/public/scores"
payload = json.dumps({"traceId": trace_id, "name": name, "value": float(value), "dataType": "NUMERIC", "comment": comment})
req = Request(url, data=payload.encode(), method="POST")
req.add_header("Content-Type", "application/json")
creds = base64.b64encode(f"{pk}:{sk}".encode()).decode()
req.add_header("Authorization", f"Basic {creds}")
try:
    urlopen(req, timeout=5)
except Exception:
    pass
PYEOF
}

echo "============================================"
echo " fetch-reddit-story.sh"
echo " Subreddit: r/$SUBREDDIT"
echo " Post ID:   $POST_ID"
if [ -n "$LANGFUSE_TRACE_ID" ]; then
  echo " Langfuse:  $LANGFUSE_TRACE_ID"
fi
echo "============================================"
echo ""

langfuse_event "fetch.started" "{\"subreddit\":\"$SUBREDDIT\",\"post_id\":\"$POST_ID\"}"

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
    langfuse_event "fetch.comments_success" "{\"attempt\":$i,\"bytes\":$SAVED_SIZE}"
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
  langfuse_event "fetch.comments_failed" "{\"max_retries\":$MAX_RETRIES}"
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

# Send Langfuse completion event with parsed results
if [ -n "$LANGFUSE_TRACE_ID" ]; then
  PARSED_STATS=$(python3 -c "
import json
with open('$OUTPUT_JSON') as f:
    d = json.load(f)
print(json.dumps({'post_found': bool(d.get('post')), 'comment_count': d.get('comment_count', 0)}))
" 2>/dev/null || echo '{}')
  langfuse_event "fetch.complete" "$PARSED_STATS"
  COMMENT_COUNT=$(echo "$PARSED_STATS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('comment_count',0))" 2>/dev/null || echo 0)
  langfuse_score "fetch_comment_count" "$COMMENT_COUNT" "Top-level comments fetched"
fi

echo ""
echo " To view the parsed JSON:"
echo "   python3 -m json.tool $OUTPUT_JSON | head -60"
echo ""
echo " To use in the Haven import pipeline:"
echo "   python3 -c \"import json; d=json.load(open('$OUTPUT_JSON')); print(d['post']['title'])\""