#!/usr/bin/env python3
"""
discover-reddit-posts.py — Discover Reddit posts from a subreddit RSS feed

Usage:
  python3 discover-reddit-posts.py <subreddit> [--output /path/to/output.json]

This is a companion to fetch-reddit-story.sh. It fetches the subreddit's
"new" RSS feed and parses all posts into structured JSON, so you can pick
which post to retrieve comments for.

Methodology (discovered 2026-06-29):
  Same RSS workaround as fetch-reddit-story.sh — Reddit's .rss endpoint
  works intermittently with retries. The JSON API and browser are blocked.

Output:
  A JSON array of posts, each with:
    - reddit_id (e.g. "1uivv8k")
    - title
    - author
    - published (ISO 8601)
    - url (full Reddit URL)
    - selftext (plain text, first 500 chars)
    - selftext_html (full HTML content)
"""

import re
import html
import json
import sys
import time
import subprocess
import argparse
from datetime import datetime


def fetch_rss(subreddit: str, max_retries: int = 15, delay: int = 12) -> str:
    """Fetch a subreddit's RSS feed with retry logic."""
    url = f"https://www.reddit.com/r/{subreddit}/new/.rss"
    ua = "Haven/1.0 (Immigration Planning Platform)"

    for i in range(1, max_retries + 1):
        result = subprocess.run(
            [
                "curl", "-s",
                "-H", f"User-Agent: {ua}",
                "-H", "Accept: application/atom+xml",
                url,
            ],
            capture_output=True,
            text=True,
        )
        body = result.stdout

        if len(body) > 1000:
            print(f"  Attempt {i}: {len(body)} bytes — SUCCESS", file=sys.stderr)
            return body
        else:
            print(f"  Attempt {i}: {len(body)} bytes (rate-limited)", file=sys.stderr)
            time.sleep(delay)

    raise RuntimeError(f"Failed to fetch RSS feed after {max_retries} attempts")


def parse_posts(xml: str) -> list[dict]:
    """Parse Reddit Atom XML into a list of post dictionaries."""
    # Fix escaped quotes
    xml = xml.replace('\\"', '"')

    entries = re.findall(r"<entry>(.*?)</entry>", xml, re.DOTALL)
    posts = []

    for entry in entries:
        id_m = re.search(r"<id>(.*?)</id>", entry)
        title_m = re.search(r"<title>(.*?)</title>", entry)
        author_m = re.search(r"<name>(.*?)</name>", entry)
        updated_m = re.search(r"<updated>(.*?)</updated>", entry)
        content_m = re.search(r'<content type="html">(.*?)</content>', entry, re.DOTALL)

        entry_id = id_m.group(1) if id_m else ""
        title = html.unescape(title_m.group(1)) if title_m else ""
        author = author_m.group(1) if author_m else ""
        updated = updated_m.group(1) if updated_m else ""

        # Clean content
        content_html = content_m.group(1) if content_m else ""
        content_html = html.unescape(content_html)
        content_html = content_html.replace("<!-- SC_OFF -->", "").replace("<!-- SC_ON -->", "")
        content_text = re.sub(r"<[^>]+>", "", content_html)
        content_text = re.sub(r"\s+", " ", content_text).strip()

        # Extract the reddit post ID from the entry ID
        # Format: https://www.reddit.com/r/h1b/comments/1uivv8k/...
        reddit_id = ""
        url = ""
        id_match = re.search(r"/r/\w+/comments/(\w+)/", entry_id)
        if id_match:
            reddit_id = id_match.group(1)
            url = entry_id.split("?")[0] if "?" in entry_id else entry_id
        elif entry_id.startswith("t3_"):
            reddit_id = entry_id.replace("t3_", "")

        posts.append({
            "reddit_id": reddit_id,
            "title": title,
            "author": author,
            "published": updated,
            "url": url,
            "selftext": content_text[:500],
            "selftext_html": content_html.strip(),
        })

    return posts


def main():
    parser = argparse.ArgumentParser(description="Discover Reddit posts from a subreddit RSS feed")
    parser.add_argument("subreddit", help="Subreddit name (without r/ prefix)")
    parser.add_argument("--output", "-o", default=None, help="Output JSON file path (default: stdout)")
    parser.add_argument("--max-retries", type=int, default=15, help="Max fetch attempts")
    parser.add_argument("--delay", type=int, default=12, help="Seconds between retries")
    args = parser.parse_args()

    print(f"Fetching r/{args.subreddit} RSS feed...", file=sys.stderr)
    xml = fetch_rss(args.subreddit, max_retries=args.max_retries, delay=args.delay)

    print(f"Parsing posts...", file=sys.stderr)
    posts = parse_posts(xml)
    print(f"Found {len(posts)} posts", file=sys.stderr)

    # Print summary table to stderr
    print(f"\n{'#':>3}  {'Reddit ID':<10}  {'Author':<25}  Title", file=sys.stderr)
    print("-" * 100, file=sys.stderr)
    for i, post in enumerate(posts):
        print(f"{i+1:>3}  {post['reddit_id']:<10}  {post['author']:<25}  {post['title'][:60]}", file=sys.stderr)

    # Output JSON
    result = {
        "subreddit": args.subreddit,
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "post_count": len(posts),
        "posts": posts,
    }

    output = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"\nSaved to {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()