# Reddit Story Retrieval Methodology

**Created:** 2026-06-29
**Purpose:** Fetch Reddit posts + comments for the Haven community story import pipeline.

## The Problem

Reddit has aggressive bot detection that blocks most programmatic access:

| Method | Result |
|--------|--------|
| JSON API (`/comments/{id}.json`) | Returns HTML JS-challenge page, not JSON |
| Browser navigation | "You've been blocked by network security" |
| Redlib mirrors (redlib.catsarch.com etc.) | 403 or behind Anubis JS challenge |
| `curl -s` to RSS (first attempt) | 0 bytes (rate-limited) |
| **`curl -s` to `.rss` with retries + delays** | **WORKS — returns Atom XML** |

## What Works

The `.rss` endpoint is the one reliable channel. It returns Atom XML containing:

- **Original post:** title + selftext (as HTML)
- **Top-level comments:** author + body (as HTML)
- **Each entry has:** `<id>`, `<title>`, `<author><name>`, `<updated>`, `<content type="html">`
- **ID prefixes:** `t3_` = original post, `t1_` = comment

**Key trick:** Reddit rate-limits intermittently, so you need a retry loop with 10-15 second delays between attempts. Usually succeeds within 1-5 tries. **Fetch directly into a file in a single `curl` call** — calling `curl` twice in a row triggers rate-limiting on the second call.

## Scripts

### 1. `fetch-reddit-story.sh` — Fetch a specific post + comments

```bash
# Fetch post 1uivv8k from r/h1b with all its comments
./scripts/community/fetch-reddit-story.sh h1b 1uivv8k
```

**Output:** `/tmp/reddit_story_<post_id>.json`

```json
{
  "post": {
    "id": "t3_1uivv8k",
    "reddit_id": "1uivv8k",
    "title": "Laid off on H1B - best path (H4, EAD, or new H1B)...",
    "author": "/u/Correct-Click-7316",
    "published": "2026-06-29T15:34:33+00:00",
    "url": "https://www.reddit.com/r/h1b/comments/1uivv8k/...",
    "selftext": "...",
    "selftext_html": "..."
  },
  "comments": [
    {
      "id": "t1_ouj2ou3",
      "author": "/u/RevenueAdventure41",
      "published": "2026-06-29T16:23:51+00:00",
      "body": "...",
      "body_html": "..."
    }
  ],
  "comment_count": 1,
  "fetched_at": "2026-06-29T17:58:11Z",
  "source_url": "...",
  "method": "Reddit RSS feed (.rss endpoint) with retry logic",
  "limitations": ["Only top-level comments", "Rate-limited — requires retries"]
}
```

Also saves the raw XML to `/tmp/reddit_comments_<post_id>.xml` and the subreddit feed to `/tmp/reddit_subfeed_<subreddit>.xml`.

### 2. `discover-reddit-posts.py` — Discover posts from a subreddit

```bash
# List recent posts from r/h1b
python3 scripts/community/discover-reddit-posts.py h1b

# Save to a file
python3 scripts/community/discover-reddit-posts.py h1b --output /tmp/h1b_posts.json
```

Prints a summary table to stderr and outputs structured JSON to stdout (or a file).

## Full Workflow

```bash
# Step 1: Discover recent posts from a subreddit
python3 scripts/community/discover-reddit-posts.py h1b --output /tmp/h1b_posts.json

# Step 2: Pick a post ID from the output, then fetch it with comments
./scripts/community/fetch-reddit-story.sh h1b <post_id>

# Step 3: Score the story against the community rubric
# (see /docs/community-story-selection-rubric.md)

# Step 4: Format as batch JSON and run the import pipeline
# (see /scripts/community/import-curated-stories.mjs and batches/ dir)
```

## Known Limitations

1. **No nested replies:** RSS only returns top-level comments. Nested comment threads (replies to comments) are not included.
2. **Rate-limited:** Requires retries with 10-15 second delays. Usually works within 1-5 attempts.
3. **Fresh posts:** Posts only hours old may have few or no comments.
4. **Feed size:** RSS only returns the most recent ~25 entries per feed.
5. **No `num_comments` field:** RSS doesn't include the total comment count, so you can't tell if there are more comments than what the feed returns.

## Why Not the JSON API?

Reddit's JSON API (`reddit.com/comments/{id}.json`) is the "proper" way to get the full comment tree with nested replies. However, Reddit's bot detection returns an HTML JavaScript-challenge page instead of JSON. This affects:

- `curl` (any user-agent, any headers)
- Browser navigation (shows "blocked by network security")
- All alternative frontends (redlib, old.reddit.com JSON, etc.)

The RSS endpoint is the only one that still works. It's a read-only feed with limited data, but it's enough for the Haven pipeline since we primarily need the post content and top-level community responses.