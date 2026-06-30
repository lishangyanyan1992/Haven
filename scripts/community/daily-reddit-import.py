#!/usr/bin/env python3
"""
daily-reddit-import.py — Daily Reddit story discovery, scoring, and import pipeline

Usage:
  python3 daily-reddit-import.py [--dry-run] [--max-stories 10] [--output-dir /tmp] [--hours 336]

Orchestrates the full daily pipeline:
  1. Discover posts from 4 subreddits (RSS endpoint with retries)
  2. Filter to posts from the last N hours (default: 336 = 14 days)
  3. Pre-filter by immigration relevance keywords
  4. Fetch comments for top candidates (rate-limited, max ~12 fetches)
  5. Auto-score each story using OpenAI against the Haven rubric
  6. Select qualifying stories via two paths:
     a. Standard: score >= 35, has outcome OR recommendation
     b. Fresh post: <48h old, few comments, base+signal >= 20, no outcome needed
        (published with monitoring flag — monitor-reddit-comments.py tracks these)
  7. Build batch JSON with rubric scores + monitoring flag
  8. Run import-curated-stories.mjs to publish
  9. Output a summary

Requires env vars from .env.local:
  OPENAI_API_KEY, OPENAI_CHAT_MODEL,
  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  LANGFUSE_BASE_URL, LANGFUSE_STORY_PUBLIC_KEY, LANGFUSE_STORY_SECRET_KEY

Quality gates (from Haven Community Story Selection Rubric):
  - Per-component: prefer 16+, gap-fill 13-15, skip <13
  - Combined total: 40-50 HIGH, 35-39 REVIEWABLE, 30-34 BORDERLINE, <30 SKIP
  - Standard path: must have an outcome OR at least one concrete recommendation/idea
  - Fresh post path: base+signal >= 20, post <48h old, no outcome required
  - Cross-batch dedup via import script's existing Supabase check
  - Quality > quantity: if not enough good stories, publish fewer
"""

import json
import os
import re
import sys
import time
import html
import uuid
import base64
import argparse
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HAVEN_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SUBREDDITS = ["h1b", "F1Visa", "USCIS", "immigration"]
MAX_FETCH_CANDIDATES = 12  # Max posts to fetch comments for (Reddit rate-limit safe zone)
MIN_QUALIFYING_SCORE = 35  # Minimum combined score to publish (standard path)
MAX_STORIES = 10  # Maximum stories to publish per day
FETCH_DELAY = 15  # Seconds between fetch calls (avoid Reddit rate-limit)
POST_DISCOVERY_COOLDOWN = 30  # Seconds to wait after discovery before fetching comments

# Fresh-post path: publish good new posts without comments, monitor for future comments
FRESH_POST_MAX_AGE_HOURS = 48  # Posts younger than this can qualify as "fresh"
FRESH_POST_MAX_COMMENTS = 2    # Posts with 0-2 comments are "fresh" (no rich discussion yet)
FRESH_POST_MIN_BASE_SIGNAL = 20  # base_total + signal_total must be >= this for fresh posts
DEFAULT_HOURS = 336  # 14 days lookback (was 24)

# Immigration relevance keywords for pre-filtering
RELEVANCE_KEYWORDS = [
    "h1b", "h-1b", "opt", "stem opt", "ead", "layoff", "grace period",
    "transfer", "sponsor", "perm", "i-140", "i-485", "i-130",
    "priority date", "visa bulletin", "retrogression", "eb-1", "eb-2", "eb-3",
    "h4", "h-4", "f1", "f-1", "cpt", "day 1 cpt", "rfe", "noid",
    "denial", "approved", "premium processing", "consular", "stamp",
    "uscis", "change of status", "cos", "b2", "b-2", "o1", "o-1",
    "cap-exempt", "lottery", "registration", "selected", "not selected",
    "60 days", "unemployment", "stem extension", "cap gap",
]

# Hard exclusion keywords (skip these topics)
EXCLUSION_KEYWORDS = [
    "asylum", "credible fear", "credible interview",
    "dv lottery", "diversity visa", "green card lottery",
    "k-1", "k1", "fiance visa", "fiancé visa",
    "naturalization", "n-400", "citizenship application",
    "marriage green card", "marriage-based",
    "removal proceedings", "deportation", "ice detention",
    "u visa", "t visa", "vawa",
]


# ---------------------------------------------------------------------------
# Langfuse helpers
# ---------------------------------------------------------------------------

_LANGFUSE_TRACE_ID = None
_LANGFUSE_BASE_URL = None
_LANGFUSE_PUBLIC_KEY = None
_LANGFUSE_SECRET_KEY = None


def _init_langfuse():
    global _LANGFUSE_TRACE_ID, _LANGFUSE_BASE_URL, _LANGFUSE_PUBLIC_KEY, _LANGFUSE_SECRET_KEY
    _LANGFUSE_BASE_URL = os.environ.get("LANGFUSE_BASE_URL", "").rstrip("/")
    _LANGFUSE_PUBLIC_KEY = os.environ.get("LANGFUSE_STORY_PUBLIC_KEY", "")
    _LANGFUSE_SECRET_KEY = os.environ.get("LANGFUSE_STORY_SECRET_KEY", "")
    if _LANGFUSE_BASE_URL and _LANGFUSE_PUBLIC_KEY and _LANGFUSE_SECRET_KEY:
        _LANGFUSE_TRACE_ID = str(uuid.uuid4())
    else:
        _LANGFUSE_TRACE_ID = None


def langfuse_event(name, metadata=None, input_data=None, output_data=None):
    if not _LANGFUSE_TRACE_ID:
        return
    url = f"{_LANGFUSE_BASE_URL}/api/public/events"
    payload = {
        "traceId": _LANGFUSE_TRACE_ID,
        "name": name,
        "metadata": metadata or {},
    }
    if input_data is not None:
        payload["input"] = input_data
    if output_data is not None:
        payload["output"] = output_data
    _langfuse_post(url, payload)


def langfuse_score(name, value, comment=""):
    if not _LANGFUSE_TRACE_ID:
        return
    _langfuse_post(f"{_LANGFUSE_BASE_URL}/api/public/scores", {
        "traceId": _LANGFUSE_TRACE_ID,
        "name": name,
        "value": float(value),
        "dataType": "NUMERIC",
        "comment": comment,
    })


def _langfuse_post(url, payload):
    data = json.dumps(payload).encode("utf-8")
    req = Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    creds = base64.b64encode(
        f"{_LANGFUSE_PUBLIC_KEY}:{_LANGFUSE_SECRET_KEY}".encode()
    ).decode("utf-8")
    req.add_header("Authorization", f"Basic {creds}")
    try:
        urlopen(req, timeout=10)
    except (URLError, HTTPError, OSError):
        pass


# ---------------------------------------------------------------------------
# Stage 1: Discover posts from subreddits
# ---------------------------------------------------------------------------

def discover_subreddit(subreddit, output_path):
    """Run discover-reddit-posts.py for one subreddit."""
    script = os.path.join(SCRIPT_DIR, "discover-reddit-posts.py")
    cmd = ["python3", script, subreddit, "--output", output_path]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        print(f"  [WARN] discover {subreddit} failed: {result.stderr[:200]}", file=sys.stderr)
        return None
    with open(output_path) as f:
        return json.load(f)


def discover_all(output_dir):
    """Discover posts from all configured subreddits."""
    all_posts = []
    for sr in SUBREDDITS:
        out = os.path.join(output_dir, f"discover_{sr}.json")
        print(f"[DISCOVER] r/{sr}...", file=sys.stderr)
        data = discover_subreddit(sr, out)
        if data and "posts" in data:
            posts = data["posts"]
            for p in posts:
                p["subreddit"] = sr
            all_posts.extend(posts)
            print(f"  Found {len(posts)} posts", file=sys.stderr)
        else:
            print(f"  No posts found", file=sys.stderr)
        time.sleep(2)  # Be gentle between subreddits

    langfuse_event("daily.discover_complete", {
        "subreddits": SUBREDDITS,
        "total_posts": len(all_posts),
    })
    return all_posts


# ---------------------------------------------------------------------------
# Stage 2: Filter to last 24 hours
# ---------------------------------------------------------------------------

def filter_last_24h(posts, hours=24):
    """Keep only posts from the last N hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    fresh = []
    for p in posts:
        pub = p.get("published", "")
        # Parse ISO 8601: 2026-06-29T12:00:00+00:00 or ...Z
        try:
            if pub.endswith("Z"):
                dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            else:
                dt = datetime.fromisoformat(pub)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt >= cutoff:
                p["_age_hours"] = round((datetime.now(timezone.utc) - dt).total_seconds() / 3600, 1)
                fresh.append(p)
        except (ValueError, TypeError):
            # If we can't parse the date, keep it (might be very fresh)
            p["_age_hours"] = None
            fresh.append(p)

    print(f"[FILTER] {len(posts)} posts -> {len(fresh)} within last {hours}h", file=sys.stderr)
    return fresh


# ---------------------------------------------------------------------------
# Stage 3: Relevance pre-filter
# ---------------------------------------------------------------------------

def is_relevant(post):
    """Quick keyword-based pre-filter. Returns True if the post is immigration-relevant."""
    text = (post.get("title", "") + " " + post.get("selftext", "")).lower()

    # Check exclusions first
    for kw in EXCLUSION_KEYWORDS:
        if kw in text:
            return False, f"excluded: {kw}"

    # Check relevance
    for kw in RELEVANCE_KEYWORDS:
        if kw in text:
            return True, f"matched: {kw}"

    return False, "no keyword match"


def filter_relevant(posts):
    """Pre-filter posts by immigration relevance keywords."""
    relevant = []
    skipped = []
    for p in posts:
        ok, reason = is_relevant(p)
        if ok:
            relevant.append(p)
        else:
            skipped.append((p.get("reddit_id", "?"), reason))

    print(f"[FILTER] {len(posts)} posts -> {len(relevant)} relevant ({len(skipped)} skipped)", file=sys.stderr)
    if skipped:
        for sid, reason in skipped[:5]:
            print(f"  Skip {sid}: {reason}", file=sys.stderr)
    return relevant


# ---------------------------------------------------------------------------
# Stage 4: Fetch comments for candidates
# ---------------------------------------------------------------------------

def fetch_comments(subreddit, post_id, output_dir):
    """Run fetch-reddit-story.sh for one post. Returns parsed JSON or None."""
    script = os.path.join(SCRIPT_DIR, "fetch-reddit-story.sh")
    # fetch-reddit-story.sh hardcodes output to /tmp/reddit_story_{post_id}.json
    fetch_output = f"/tmp/reddit_story_{post_id}.json"
    local_output = os.path.join(output_dir, f"reddit_story_{post_id}.json")

    # Skip if already fetched (re-use from cache)
    if os.path.exists(local_output) and os.path.getsize(local_output) > 100:
        with open(local_output) as f:
            return json.load(f)
    if os.path.exists(fetch_output) and os.path.getsize(fetch_output) > 100:
        # Copy from /tmp to our output dir
        import shutil
        shutil.copy2(fetch_output, local_output)
        with open(local_output) as f:
            return json.load(f)

    cmd = ["bash", script, subreddit, post_id]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        print(f"  [WARN] fetch {post_id} failed: {result.stderr[:200]}", file=sys.stderr)
        return None

    # fetch-reddit-story.sh writes to /tmp/reddit_story_{post_id}.json
    if os.path.exists(fetch_output):
        import shutil
        shutil.copy2(fetch_output, local_output)
        with open(local_output) as f:
            return json.load(f)
    return None


def fetch_all_comments(posts, output_dir, max_fetch=MAX_FETCH_CANDIDATES):
    """Fetch comments for the top N candidate posts. Rate-limited."""
    fetched = []
    for i, p in enumerate(posts[:max_fetch]):
        rid = p.get("reddit_id", "")
        sr = p.get("subreddit", "")
        print(f"[FETCH {i+1}/{min(max_fetch, len(posts))}] r/{sr} {rid}: {p.get('title', '')[:60]}", file=sys.stderr)

        data = fetch_comments(sr, rid, output_dir)
        if data and data.get("post"):
            # Merge discovery metadata with fetch data
            data["subreddit"] = sr
            data["discovery_meta"] = p
            fetched.append(data)
            cc = data.get("comment_count", 0)
            print(f"  OK: {cc} comments", file=sys.stderr)
            langfuse_event("daily.fetch_success", {
                "post_id": rid, "subreddit": sr, "comment_count": cc,
            })
        else:
            print(f"  FAILED", file=sys.stderr)
            langfuse_event("daily.fetch_failed", {"post_id": rid, "subreddit": sr})

        if i < min(max_fetch, len(posts)) - 1:
            time.sleep(FETCH_DELAY)

    print(f"[FETCH] {len(fetched)}/{min(max_fetch, len(posts))} posts fetched with comments", file=sys.stderr)
    langfuse_event("daily.fetch_batch_complete", {
        "attempted": min(max_fetch, len(posts)),
        "succeeded": len(fetched),
    })
    return fetched


# ---------------------------------------------------------------------------
# Stage 5: Auto-score with OpenAI
# ---------------------------------------------------------------------------

RUBRIC_SYSTEM_PROMPT = """You are a story quality evaluator for Haven, an immigration planning platform for H1B/OPT/visa holders.

You score Reddit stories against the Haven Community Story Selection Rubric. Return ONLY a JSON object with these exact fields:

{
  "base": {
    "audience_fit": 0-4,
    "decision_value": 0-4,
    "case_specificity": 0-4,
    "product_alignment": 0-4,
    "rewrite_safety": 0-4
  },
  "signal": {
    "before_after": 0-2,
    "decision_fork": 0-2,
    "timeline": 0-2,
    "transferable_lesson": 0-2,
    "search_demand": 0-2,
    "comment_quality": 0-2,
    "misconception": 0-2,
    "outcome_diversity": 0-2,
    "trust_safety": 0-2,
    "narrative_clarity": 0-2
  },
  "comment_value": 0-10,
  "base_total": <calculated>,
  "signal_total": <calculated>,
  "combined_total": <calculated>,
  "tier": "HIGH PRIORITY" | "REVIEWABLE" | "BORDERLINE" | "SKIP",
  "has_outcome": true/false,
  "has_recommendation": true/false,
  "skip_reason": "<reason or empty>",
  "one_line": "<one-line summary of the story>"
}

Scoring rules:
- audience_fit 4: Directly H-1B, OPT/STEM OPT, employment-based GC, layoff, transfer, priority date
- decision_value 4: Shows concrete decision, tradeoff, action, or outcome
- case_specificity 4: Includes status, timing, action, and result/current state
- product_alignment 4: Supports Haven surface (layoff planner, advisor, sponsor search, timeline, community)
- rewrite_safety 4: Easy to anonymize while preserving useful facts
- Signals: 2=strong, 1=partial, 0=missing
- comment_value 9-10: Multiple high-signal comments with concrete suggestions + prior experiences
- comment_value 7-8: At least one strong comment
- comment_value 4-6: Some useful but incomplete comments
- comment_value 1-3: Mostly sympathy/speculation
- comment_value 0: No meaningful comments

Tier thresholds:
- combined_total >= 40: HIGH PRIORITY
- combined_total >= 35: REVIEWABLE
- combined_total >= 30: BORDERLINE
- combined_total < 30: SKIP

CRITICAL: Skip (set tier=SKIP) if:
- No outcome AND no recommendations/ideas from poster or commenters AND the post is NOT a fresh/unfolding situation (see below)
- Family-based, asylum, citizenship, or humanitarian content
- Mostly legal advice, not lived experience
- Cannot be safely anonymized
- Mainly names/criticizes a person, employer, school, or law firm

FRESH POST EXCEPTION: If the post has 0-2 comments and no outcome yet, but:
- The situation is clear and specific (status, timing, concrete question/decision)
- The base score (audience_fit + decision_value + case_specificity + product_alignment + rewrite_safety) is strong (>=10)
- The base_total + signal_total >= 20
Then set tier to "BORDERLINE" (not SKIP) and set has_outcome=false, has_recommendation=false.
The story will be published as a "monitoring" story and re-checked later for comments.
Do NOT set skip_reason in this case.

Return ONLY the JSON. No markdown, no explanation."""


def score_story_with_openai(story_data, api_key, model):
    """Score a single story using OpenAI against the rubric."""
    post = story_data.get("post", {})
    comments = story_data.get("comments", [])

    # Build story text for scoring
    title = post.get("title", "")
    body = post.get("selftext", "")[:2000]  # Truncate to stay within token limits
    comment_texts = [c.get("body", "")[:500] for c in comments[:8] if c.get("body", "").strip()]
    comments_block = "\n---\n".join(comment_texts) if comment_texts else "(no comments)"

    user_msg = f"""Title: {title}

Body:
{body}

Comments ({len(comments)} total, showing up to 8):
{comments_block}

Score this story against the Haven rubric. Return ONLY the JSON object."""

    # Use OpenAI chat completions API
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": RUBRIC_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.2,
        "max_tokens": 800,
    }

    data = json.dumps(payload).encode("utf-8")
    req = Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {api_key}")

    try:
        resp = urlopen(req, timeout=30)
        result = json.loads(resp.read().decode("utf-8"))
        content = result["choices"][0]["message"]["content"].strip()
        # Strip any markdown code fences
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\n?", "", content)
            content = re.sub(r"\n?```$", "", content)
        scores = json.loads(content)

        # Calculate totals if not provided
        base_total = scores.get("base_total") or sum(scores.get("base", {}).values())
        signal_total = scores.get("signal_total") or sum(scores.get("signal", {}).values())
        comment_val = scores.get("comment_value", 0)
        combined = scores.get("combined_total") or (base_total + signal_total + comment_val)

        if combined >= 40:
            tier = "HIGH PRIORITY"
        elif combined >= 35:
            tier = "REVIEWABLE"
        elif combined >= 30:
            tier = "BORDERLINE"
        else:
            tier = "SKIP"

        return {
            "base": scores.get("base", {}),
            "signal": scores.get("signal", {}),
            "comment_value": comment_val,
            "base_total": base_total,
            "signal_total": signal_total,
            "combined_total": combined,
            "tier": tier,
            "has_outcome": scores.get("has_outcome", False),
            "has_recommendation": scores.get("has_recommendation", False),
            "skip_reason": scores.get("skip_reason", ""),
            "one_line": scores.get("one_line", title[:80]),
        }
    except (URLError, HTTPError, KeyError, json.JSONDecodeError, OSError) as e:
        print(f"  [WARN] OpenAI scoring failed: {e}", file=sys.stderr)
        return None


def score_all_stories(fetched_stories, output_dir, force=False):
    """Score all fetched stories with OpenAI."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    model = os.environ.get("OPENAI_CHAT_MODEL", "gpt-4o")
    if not api_key:
        print("[ERROR] OPENAI_API_KEY not set — cannot score stories", file=sys.stderr)
        return []

    scored = []
    for i, story_data in enumerate(fetched_stories):
        rid = story_data.get("post", {}).get("reddit_id", "?")
        print(f"[SCORE {i+1}/{len(fetched_stories)}] {rid}...", file=sys.stderr)

        scores = score_story_with_openai(story_data, api_key, model)
        if scores:
            story_data["rubric_scores"] = scores
            combined = scores["combined_total"]
            tier = scores["tier"]
            has_outcome = scores.get("has_outcome", False)
            has_rec = scores.get("has_recommendation", False)
            skip_reason = scores.get("skip_reason", "")
            base_total = scores.get("base_total", 0)
            signal_total = scores.get("signal_total", 0)
            comment_val = scores.get("comment_value", 0)
            base_signal = base_total + signal_total

            # Determine if this is a fresh post (young, few comments)
            post_info = story_data.get("post", {})
            post_age_hours = post_info.get("_age_hours")
            num_comments = len(story_data.get("comments", []))
            is_fresh = (
                post_age_hours is not None
                and post_age_hours <= FRESH_POST_MAX_AGE_HOURS
                and num_comments <= FRESH_POST_MAX_COMMENTS
            )

            print(f"  Score: {combined}/50 ({tier}) outcome={has_outcome} rec={has_rec} "
                  f"base+signal={base_signal} fresh={is_fresh} age={post_age_hours}h comments={num_comments}",
                  file=sys.stderr)
            if skip_reason:
                print(f"  Skip reason: {skip_reason}", file=sys.stderr)

            if force:
                print(f"  -> FORCE (bypassing filters)", file=sys.stderr)
                story_data["qualification_path"] = "force"
                scored.append(story_data)
                langfuse_score("daily_story_score", combined, f"{rid}: {tier}")
                continue

            # Fresh-post path: good post, no comments/outcome yet, publish + monitor
            if is_fresh and base_signal >= FRESH_POST_MIN_BASE_SIGNAL and not has_outcome and not has_rec:
                print(f"  -> FRESH POST (base+signal={base_signal} >= {FRESH_POST_MIN_BASE_SIGNAL}, "
                      f"will monitor for comments)", file=sys.stderr)
                story_data["qualification_path"] = "fresh"
                story_data["monitoring"] = True
                scored.append(story_data)
                langfuse_score("daily_story_score", combined, f"{rid}: FRESH")
                continue

            # Standard path: must have outcome OR recommendation
            if tier == "SKIP" or (not has_outcome and not has_rec):
                print(f"  -> SKIP (tier or no outcome/rec)", file=sys.stderr)
                continue

            if combined >= MIN_QUALIFYING_SCORE:
                story_data["qualification_path"] = "standard"
                scored.append(story_data)
                langfuse_score("daily_story_score", combined, f"{rid}: {tier}")
            else:
                print(f"  -> Below threshold ({combined} < {MIN_QUALIFYING_SCORE})", file=sys.stderr)
        else:
            print(f"  -> Scoring failed, skipping", file=sys.stderr)

    # Sort: standard posts first (by combined score desc), then fresh posts (by base+signal desc)
    scored.sort(key=lambda s: (
        0 if s.get("qualification_path") == "standard" else 1,
        -(s["rubric_scores"]["combined_total"])
    ))
    fresh_count = sum(1 for s in scored if s.get("qualification_path") == "fresh")
    standard_count = sum(1 for s in scored if s.get("qualification_path") == "standard")
    print(f"\n[SCORE] {len(scored)} stories qualify "
          f"({standard_count} standard, {fresh_count} fresh-post)", file=sys.stderr)
    return scored


# ---------------------------------------------------------------------------
# Stage 6: Build batch JSON
# ---------------------------------------------------------------------------

def clean_text(text):
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"submitted by.*", "", text, flags=re.DOTALL)
    text = re.sub(r"&#x200B;?", "", text)
    text = text.strip()
    return text


def build_batch(scored_stories, output_path, max_stories=MAX_STORIES):
    """Build the batch JSON for import-curated-stories.mjs."""
    stories = []
    today = datetime.now().strftime("%Y-%m-%d")

    for sd in scored_stories[:max_stories]:
        post = sd.get("post", {})
        comments_raw = sd.get("comments", [])
        rid = post.get("reddit_id", "")
        sr = sd.get("subreddit", "")

        comment_bodies = []
        for c in comments_raw:
            body = clean_text(c.get("body", ""))
            if body and len(body) > 20:
                comment_bodies.append(body)

        rs = sd.get("rubric_scores", {})

        story = {
            "source_story_id": rid,
            "title": clean_text(post.get("title", "")),
            "body": clean_text(post.get("selftext", "")),
            "source_url": f"https://www.reddit.com/r/{sr}/comments/{rid}/",
            "date": post.get("published", ""),
            "author_name": post.get("author", "Reddit user"),
            "comments": comment_bodies,
            "rubric_scores": {
                "base_total": rs.get("base_total", 0),
                "signal_total": rs.get("signal_total", 0),
                "comment_value": rs.get("comment_value", 0),
                "combined_total": rs.get("combined_total", 0),
                "tier": rs.get("tier", ""),
            },
        }
        # Add monitoring flag for fresh posts
        if sd.get("monitoring"):
            story["monitoring"] = True
            story["qualification_path"] = sd.get("qualification_path", "fresh")
        stories.append(story)
        print(f"  {rid}: {rs.get('combined_total', '?')}/50 ({rs.get('tier', '?')}) — {story['title'][:60]}", file=sys.stderr)

    batch = {
        "source": "reddit",
        "note": f"Daily auto-import {today}: {len(stories)} stories from r/{', r/'.join(SUBREDDITS)}. "
                f"Auto-scored with OpenAI against Haven rubric. Quality > quantity.",
        "stories": stories,
    }

    with open(output_path, "w") as f:
        json.dump(batch, f, indent=2, ensure_ascii=False)

    print(f"\n[BATCH] {len(stories)} stories written to {output_path}", file=sys.stderr)
    return batch


# ---------------------------------------------------------------------------
# Stage 7: Run import
# ---------------------------------------------------------------------------

def run_import(batch_path, dry_run=False):
    """Run import-curated-stories.mjs to publish stories."""
    if dry_run:
        print("[IMPORT] Dry run — skipping import", file=sys.stderr)
        return {"skipped": True, "reason": "dry run"}

    script = os.path.join(SCRIPT_DIR, "import-curated-stories.mjs")
    cmd = ["node", script, batch_path]
    print(f"[IMPORT] Running: {' '.join(cmd)}", file=sys.stderr)

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600, cwd=HAVEN_ROOT)
    print(result.stdout, file=sys.stderr)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if result.returncode != 0:
        print(f"[IMPORT] FAILED (exit {result.returncode})", file=sys.stderr)
        return {"error": f"Import failed with exit code {result.returncode}", "stderr": result.stderr[:500]}

    print(f"[IMPORT] Success", file=sys.stderr)
    return {"success": True, "stdout": result.stdout[-500:]}


# ---------------------------------------------------------------------------
# Stage 8: Summary
# ---------------------------------------------------------------------------

def build_summary(scored_stories, batch, import_result, output_path):
    """Build a human-readable summary."""
    lines = []
    lines.append("=" * 80)
    lines.append("DAILY REDDIT IMPORT SUMMARY")
    lines.append(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M %Z')}")
    lines.append(f"Subreddits: r/{', r/'.join(SUBREDDITS)}")
    lines.append("=" * 80)
    lines.append("")

    if not scored_stories:
        lines.append("No qualifying stories found today.")
        lines.append("")
        lines.append("This is OK — quality > quantity. No stories were published.")
    else:
        published = batch.get('stories', [])
        fresh_count = sum(1 for s in published if s.get("monitoring"))
        standard_count = len(published) - fresh_count
        lines.append(f"PUBLISHED: {len(published)} stories ({standard_count} standard, {fresh_count} fresh/monitoring)")
        lines.append("")
        lines.append("STORIES:")
        lines.append("-" * 80)
        for i, sd in enumerate(scored_stories[:len(published)]):
            post = sd.get("post", {})
            rid = post.get("reddit_id", "?")
            sr = sd.get("subreddit", "?")
            rs = sd.get("rubric_scores", {})
            title = clean_text(post.get("title", ""))[:70]
            cc = sd.get("comment_count", 0)
            combined = rs.get("combined_total", "?")
            tier = rs.get("tier", "?")
            one_line = rs.get("one_line", "")
            qpath = sd.get("qualification_path", "standard")
            monitoring_tag = " [MONITORING]" if sd.get("monitoring") else ""

            lines.append(f"  {i+1}. [{combined}/50 {tier}]{monitoring_tag} r/{sr} {rid}")
            lines.append(f"     Title: {title}")
            lines.append(f"     Comments: {cc}")
            if one_line:
                lines.append(f"     Summary: {one_line[:80]}")
            lines.append("")

    lines.append("-" * 80)
    if import_result.get("success"):
        lines.append("IMPORT: SUCCESS")
    elif import_result.get("skipped"):
        reason = import_result.get("reason", "dry run")
        lines.append(f"IMPORT: SKIPPED ({reason})")
    elif import_result.get("error"):
        lines.append(f"IMPORT: FAILED — {import_result.get('error', '')[:100]}")
    else:
        lines.append("IMPORT: Not run")

    if _LANGFUSE_TRACE_ID:
        lines.append(f"LANGFUSE TRACE: {_LANGFUSE_TRACE_ID}")
    lines.append("=" * 80)

    summary = "\n".join(lines)
    with open(output_path, "w") as f:
        f.write(summary)
    print(summary)
    return summary


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Daily Reddit story import pipeline")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually import, just discover/score/report")
    parser.add_argument("--max-stories", type=int, default=MAX_STORIES, help="Max stories to publish")
    parser.add_argument("--max-fetch", type=int, default=MAX_FETCH_CANDIDATES, help="Max posts to fetch comments for")
    parser.add_argument("--output-dir", default="/tmp", help="Working directory for temp files")
    parser.add_argument("--hours", type=int, default=336, help="Look back N hours for posts (default: 336 = 14 days)")
    parser.add_argument("--min-score", type=int, default=35, help="Minimum combined score to qualify")
    parser.add_argument("--force", action="store_true", help="Bypass all filters (testing only)")
    args = parser.parse_args()

    global MIN_QUALIFYING_SCORE
    MIN_QUALIFYING_SCORE = args.min_score

    os.makedirs(args.output_dir, exist_ok=True)
    _init_langfuse()

    print(f"\n{'='*80}", file=sys.stderr)
    print(f"DAILY REDDIT IMPORT — {datetime.now().strftime('%Y-%m-%d %H:%M %Z')}", file=sys.stderr)
    print(f"Subreddits: r/{', r/'.join(SUBREDDITS)}", file=sys.stderr)
    print(f"Max stories: {args.max_stories} | Max fetch: {args.max_fetch} | Hours: {args.hours}", file=sys.stderr)
    if args.dry_run:
        print(f"DRY RUN — will not import", file=sys.stderr)
    print(f"{'='*80}\n", file=sys.stderr)

    langfuse_event("daily.run_started", {
        "subreddits": SUBREDDITS,
        "max_stories": args.max_stories,
        "max_fetch": args.max_fetch,
        "hours": args.hours,
        "dry_run": args.dry_run,
    })

    # Stage 1: Discover
    all_posts = discover_all(args.output_dir)
    if not all_posts:
        print("\nNo posts discovered. Exiting.", file=sys.stderr)
        summary = build_summary([], {"stories": []}, {"error": "no posts discovered"},
                               os.path.join(args.output_dir, "daily_summary.txt"))
        return

    # Stage 2: Filter to last 24h
    fresh = filter_last_24h(all_posts, hours=args.hours)

    # Stage 3: Relevance pre-filter
    relevant = filter_relevant(fresh)

    if not relevant:
        print("\nNo relevant posts found. Exiting.", file=sys.stderr)
        summary = build_summary([], {"stories": []}, {"error": "no relevant posts"},
                               os.path.join(args.output_dir, "daily_summary.txt"))
        return

    # Dedup by reddit_id
    seen_ids = set()
    unique = []
    for p in relevant:
        rid = p.get("reddit_id", "")
        if rid and rid not in seen_ids:
            seen_ids.add(rid)
            unique.append(p)
    print(f"[DEDUP] {len(relevant)} -> {len(unique)} unique posts", file=sys.stderr)

    # Sort by age (newest first)
    unique.sort(key=lambda p: -(p.get("_age_hours") or 0))  # Oldest first = more comments

    # Stage 4: Fetch comments
    # Cooldown: we just made 4 subreddit RSS requests, Reddit is likely rate-limiting.
    # Wait before starting comment fetches.
    print(f"\n[COOLDOWN] Waiting {POST_DISCOVERY_COOLDOWN}s before fetching (Reddit rate-limit recovery)...", file=sys.stderr)
    time.sleep(POST_DISCOVERY_COOLDOWN)

    fetched = fetch_all_comments(unique, args.output_dir, max_fetch=args.max_fetch)

    if not fetched:
        print("\nNo posts fetched with comments. Exiting.", file=sys.stderr)
        summary = build_summary([], {"stories": []}, {"error": "no posts fetched"},
                               os.path.join(args.output_dir, "daily_summary.txt"))
        return

    # Stage 5: Score with OpenAI
    scored = score_all_stories(fetched, args.output_dir, force=args.force)

    # Stage 6: Build batch
    batch_path = os.path.join(args.output_dir, "daily_batch.json")
    batch = build_batch(scored, batch_path, max_stories=args.max_stories)

    # Stage 7: Run import (skip if no qualifying stories)
    if not scored:
        print("\nNo qualifying stories found today.", file=sys.stderr)
        print("This is OK — quality > quantity. No stories were published.", file=sys.stderr)
        import_result = {"skipped": True, "reason": "no qualifying stories"}
    else:
        import_result = run_import(batch_path, dry_run=args.dry_run)

    # Stage 8: Summary
    summary_path = os.path.join(args.output_dir, "daily_summary.txt")
    summary = build_summary(scored, batch, import_result, summary_path)

    langfuse_event("daily.run_complete", {
        "discovered": len(all_posts),
        "fresh_24h": len(fresh),
        "relevant": len(relevant),
        "unique": len(unique),
        "fetched": len(fetched),
        "scored": len(scored),
        "published": len(batch.get("stories", [])),
        "import_success": import_result.get("success", False),
        "dry_run": args.dry_run,
    })

    print(f"\n[DONE] Summary saved to {summary_path}", file=sys.stderr)


if __name__ == "__main__":
    main()