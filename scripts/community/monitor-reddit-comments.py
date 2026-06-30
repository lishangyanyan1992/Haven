#!/usr/bin/env python3
"""
monitor-reddit-comments.py — Daily comment monitoring for fresh-post stories.

Queries Supabase for community_import_items with monitoring=true in
observability_metadata, re-fetches Reddit comments via the RSS endpoint,
updates the community post comments, and removes the monitoring flag when
the story is mature (3+ comments or >7 days old).

Usage:
  python3 monitor-reddit-comments.py [--dry-run] [--output-dir /tmp]

Env vars required (from .env.local):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Optional:
  LANGFUSE_BASE_URL, LANGFUSE_STORY_PUBLIC_KEY, LANGFUSE_STORY_SECRET_KEY
"""

import argparse
import json
import os
import re
import html
import sys
import time
import subprocess
from datetime import datetime, timezone, timedelta
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HAVEN_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))

# Monitoring thresholds
MATURITY_MIN_COMMENTS = 3   # 3+ comments = mature, stop monitoring
MATURITY_MAX_AGE_DAYS = 7   # >7 days old = stop monitoring regardless
RSS_RETRY_COUNT = 3
RSS_RETRY_DELAY = 30        # seconds between retries
POST_FETCH_COOLDOWN = 30    # seconds between Reddit RSS fetches


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def supabase_request(url, service_key, method="GET", body=None):
    """Make a Supabase REST API call."""
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body else None
    req = Request(url, data=data, method=method, headers=headers)
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except (URLError, HTTPError, json.JSONDecodeError) as e:
        print(f"  [ERROR] Supabase request failed: {e}", file=sys.stderr)
        return None


def fetch_monitoring_stories(supabase_url, service_key):
    """Query Supabase for import items with monitoring=true."""
    # Use the REST API with a filter on the JSONB column
    # Select only existing columns; source_url is inside source_payload_private
    url = (
        f"{supabase_url}/rest/v1/community_import_items?"
        f"select=id,source_story_id,source_payload_private,"
        f"observability_metadata,published_post_id,created_at"
        f"&source=eq.reddit"
    )
    result = supabase_request(url, service_key)
    if not result:
        return []

    monitoring = []
    for item in result:
        obs = item.get("observability_metadata", {})
        if isinstance(obs, str):
            try:
                obs = json.loads(obs)
            except json.JSONDecodeError:
                continue
        if obs.get("monitoring") is True:
            monitoring.append(item)

    return monitoring


def update_import_item(supabase_url, service_key, item_id, obs_metadata):
    """Update an import item's observability_metadata."""
    url = f"{supabase_url}/rest/v1/community_import_items?id=eq.{item_id}"
    body = {"observability_metadata": obs_metadata}
    return supabase_request(url, service_key, method="PATCH", body=body)


def sync_comments(supabase_url, service_key, post_id, item_id, comments):
    """Replace comments for a community post (same pattern as syncImportedComments)."""
    # Delete existing comments for this post+item
    del_url = (
        f"{supabase_url}/rest/v1/community_post_comments?"
        f"post_id=eq.{post_id}&import_item_id=eq.{item_id}"
    )
    supabase_request(del_url, service_key, method="DELETE")

    if not comments:
        return

    # Insert new comments
    insert_url = f"{supabase_url}/rest/v1/community_post_comments"
    rows = []
    for idx, comment in enumerate(comments):
        author_label = f"Reddit commenter #{idx + 1}"
        rows.append({
            "post_id": post_id,
            "import_item_id": item_id,
            "user_id": None,
            "author_label": author_label,
            "body": comment["body"],
            "sort_order": idx,
        })
    supabase_request(insert_url, service_key, method="POST", body=rows)


# ---------------------------------------------------------------------------
# Reddit RSS fetch (inline — same logic as fetch-reddit-story.sh)
# ---------------------------------------------------------------------------

def fetch_reddit_comments(subreddit, post_id, output_dir="/tmp"):
    """Fetch comments for a Reddit post via the RSS endpoint."""
    ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Haven/1.0"
    rss_url = f"https://www.reddit.com/r/{subreddit}/comments/{post_id}/.rss"
    raw_path = os.path.join(output_dir, f"monitor_reddit_{post_id}.xml")

    for attempt in range(1, RSS_RETRY_COUNT + 1):
        req = Request(rss_url, headers={
            "User-Agent": ua,
            "Accept": "application/atom+xml",
        })
        try:
            with urlopen(req, timeout=30) as resp:
                xml = resp.read().decode("utf-8", errors="replace")
        except (URLError, HTTPError, OSError) as e:
            print(f"    Attempt {attempt}: fetch error — {e}", file=sys.stderr)
            time.sleep(RSS_RETRY_DELAY)
            continue

        if len(xml) > 1000:
            with open(raw_path, "w") as f:
                f.write(xml)
            break
        else:
            print(f"    Attempt {attempt}: {len(xml)} bytes (rate-limited)", file=sys.stderr)
            time.sleep(RSS_RETRY_DELAY)
    else:
        print(f"    FAILED to fetch RSS after {RSS_RETRY_COUNT} attempts", file=sys.stderr)
        return None

    # Parse the RSS XML
    xml = xml.replace('\\"', '"')
    entries_raw = re.findall(r'<entry>(.*?)</entry>', xml, re.DOTALL)

    comments = []
    for entry in entries_raw:
        id_m = re.search(r'<id>(.*?)</id>', entry)
        content_m = re.search(r'<content type="html">(.*?)</content>', entry, re.DOTALL)
        author_m = re.search(r'<name>(.*?)</name>', entry)

        entry_id = id_m.group(1) if id_m else ""
        if entry_id.startswith("t1_"):
            content_html = content_m.group(1) if content_m else ""
            content_html = html.unescape(content_html)
            content_html = content_html.replace('<!-- SC_OFF -->', '').replace('<!-- SC_ON -->', '')
            content_text = re.sub(r'<[^>]+>', '', content_html)
            content_text = re.sub(r'\s+', ' ', content_text).strip()

            comments.append({
                "id": entry_id,
                "author": author_m.group(1) if author_m else "",
                "body": content_text,
            })

    return comments


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def extract_subreddit_from_url(source_payload_private, source_story_id):
    """Extract subreddit from source_url inside source_payload_private."""
    if source_payload_private:
        if isinstance(source_payload_private, str):
            try:
                source_payload_private = json.loads(source_payload_private)
            except json.JSONDecodeError:
                pass
        if isinstance(source_payload_private, dict):
            source_url = source_payload_private.get("source_url", "")
            if source_url:
                m = re.search(r'/r/(\w+)/', source_url)
                if m:
                    return m.group(1)
    return None


def get_post_age_days(item):
    """Get age of the import item in days from created_at."""
    created = item.get("created_at", "")
    if not created:
        return 0
    try:
        dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
        age = datetime.now(timezone.utc) - dt
        return age.total_seconds() / 86400
    except (ValueError, TypeError):
        return 0


def main():
    parser = argparse.ArgumentParser(description="Monitor Reddit comments for fresh-post stories")
    parser.add_argument("--dry-run", action="store_true", help="Don't update Supabase")
    parser.add_argument("--output-dir", default="/tmp", help="Working directory for temp files")
    args = parser.parse_args()

    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        print("[ERROR] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required", file=sys.stderr)
        sys.exit(1)

    print("[MONITOR] Fetching monitoring stories from Supabase...", file=sys.stderr)
    items = fetch_monitoring_stories(supabase_url, service_key)
    print(f"[MONITOR] Found {len(items)} stories to monitor", file=sys.stderr)

    if not items:
        print("[MONITOR] No monitoring stories. Done.", file=sys.stderr)
        # Write empty summary
        summary_path = os.path.join(args.output_dir, "daily-reddit-import", "monitor_summary.txt")
        os.makedirs(os.path.dirname(summary_path), exist_ok=True)
        with open(summary_path, "w") as f:
            f.write("Reddit Comment Monitoring Summary\n")
            f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M %Z')}\n")
            f.write("No monitoring stories found. Nothing to do.\n")
        print(json.dumps({"checked": 0, "updated": 0, "matured": 0, "failed": 0}))
        return

    checked = 0
    updated = 0
    matured = 0
    failed = 0
    results = []

    for item in items:
        item_id = item.get("id")
        source_story_id = item.get("source_story_id", "")
        source_payload = item.get("source_payload_private", {})
        post_id = item.get("published_post_id")
        obs = item.get("observability_metadata", {})
        if isinstance(obs, str):
            obs = json.loads(obs) if obs else {}

        subreddit = extract_subreddit_from_url(source_payload, source_story_id)
        age_days = get_post_age_days(item)

        print(f"\n[MONITOR] {source_story_id} (r/{subreddit or '?'}, {age_days:.1f}d old, post_id={post_id})",
              file=sys.stderr)

        if not subreddit:
            print(f"  [SKIP] Cannot determine subreddit from URL", file=sys.stderr)
            failed += 1
            continue

        if not post_id:
            print(f"  [SKIP] No published_post_id — story may not have been published yet", file=sys.stderr)
            failed += 1
            continue

        checked += 1

        # Fetch fresh comments
        comments = fetch_reddit_comments(subreddit, source_story_id, args.output_dir)
        if comments is None:
            print(f"  [FAILED] Could not fetch comments", file=sys.stderr)
            failed += 1
            results.append({"id": source_story_id, "status": "fetch_failed", "comments": 0})
            continue

        comment_count = len(comments)
        print(f"  Fetched {comment_count} comments", file=sys.stderr)

        # Check maturity
        is_mature = comment_count >= MATURITY_MIN_COMMENTS or age_days >= MATURITY_MAX_AGE_DAYS

        if args.dry_run:
            print(f"  [DRY RUN] Would {'update comments + remove monitoring' if is_mature else 'update comments'}",
                  file=sys.stderr)
            results.append({"id": source_story_id, "status": "dry_run", "comments": comment_count,
                            "mature": is_mature})
            continue

        # Update comments in Supabase
        if comment_count > 0:
            sync_comments(supabase_url, service_key, post_id, item_id, comments)
            updated += 1
            print(f"  Updated {comment_count} comments in Supabase", file=sys.stderr)

        # Remove monitoring flag if mature
        if is_mature:
            obs["monitoring"] = False
            obs["monitoring_ended_at"] = datetime.now(timezone.utc).isoformat()
            obs["monitoring_end_reason"] = (
                f"mature: {comment_count} comments" if comment_count >= MATURITY_MIN_COMMENTS
                else f"expired: {age_days:.1f} days old"
            )
            update_import_item(supabase_url, service_key, item_id, obs)
            matured += 1
            print(f"  -> MATURE, monitoring flag removed", file=sys.stderr)
        else:
            print(f"  Still monitoring ({comment_count} comments, {age_days:.1f}d old)", file=sys.stderr)

        results.append({"id": source_story_id, "status": "ok", "comments": comment_count,
                        "mature": is_mature})

        # Rate-limit cooldown between Reddit fetches
        time.sleep(POST_FETCH_COOLDOWN)

    # Build summary
    summary_path = os.path.join(args.output_dir, "daily-reddit-import", "monitor_summary.txt")
    os.makedirs(os.path.dirname(summary_path), exist_ok=True)
    with open(summary_path, "w") as f:
        f.write("=" * 80 + "\n")
        f.write("REDDIT COMMENT MONITORING SUMMARY\n")
        f.write(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M %Z')}\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"Stories checked: {checked}\n")
        f.write(f"Comments updated: {updated}\n")
        f.write(f"Monitoring ended (mature): {matured}\n")
        f.write(f"Failed: {failed}\n\n")
        if results:
            f.write("DETAILS:\n")
            f.write("-" * 80 + "\n")
            for r in results:
                f.write(f"  {r['id']}: {r['status']} ({r.get('comments', 0)} comments"
                        f"{' — MATURE' if r.get('mature') else ''})\n")
        f.write("\n" + "=" * 80 + "\n")

    print(f"\n[MONITOR] Done: checked={checked} updated={updated} matured={matured} failed={failed}",
          file=sys.stderr)
    print(json.dumps({
        "checked": checked,
        "updated": updated,
        "matured": matured,
        "failed": failed,
        "results": results,
    }))


if __name__ == "__main__":
    main()