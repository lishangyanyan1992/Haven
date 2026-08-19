# Handoff: the community import now has a second step

Paste the block below to the agent that maintains the Reddit import pipeline.

---

The Haven community import pipeline gained a required second step on 2026-08-19.
Here is what changed and what you need to know to not break it.

## What was wrong

The Advisor's semantic search for community stories reads the
`community_advice_summaries` table — not `community_posts`. It embeds the user's
question, matches it against stored summaries, filters by topic, and re-ranks by
how well each story's tags fit the asker's profile.

That table had **zero rows**, and nothing in the codebase wrote to it. So the
vector path never ran. Every request silently fell through to a text-overlap
fallback, which treats "60-day" and "day 60" as unrelated strings — the exact
failure the semantic layer exists to prevent. 225 imported posts were invisible
to every question the Advisor was asked.

The service reports the empty table to Sentry once per process, so this had been
logged for some time.

## What now exists

`apps/haven/scripts/build-community-summaries.ts`, run as
`npm run community:summaries` from `apps/haven`.

For each community post it produces a retrieval summary — the person's situation
and outcome written in the vocabulary somebody living it would type — plus a
topic, tags, a legal caveat, and an embedding, then writes a row.

It is **idempotent**. Posts that already have a summary are skipped, so re-running
costs nothing. Flags: `--limit N`, `--dry-run`, `--force`, `--retry-skipped`.

Current state: 208 summaries from 225 posts. 75 layoffs, 57 h1b, 40
student-status, 18 work-authorization, 15 adjustment-of-status, 2 self-petition,
1 perm.

## What you must not break

**1. The step is chained inside `scripts/community/daily-reddit-cron.sh`.**

It runs *inside* the backgrounded `nohup bash -c '...'` block, after the Python
import, because the cron script exits in under five seconds — anything appended
after the `nohup` line would run before there was anything new to summarise. The
two commands are separated by a newline rather than `&&` on purpose: a partly
failed import should still get its successful posts summarised.

If you restructure that script, keep both properties. An import that runs without
the summariser recreates the original bug one day at a time, and it fails
silently — posts land, the community page looks fine, and the Advisor sees
nothing new.

**2. Do not ask a model whether a post is "usable".**

That was the original design and it was measurably unstable: over 24 posts run
three times each, the verdict flipped on 8 of them. The first full run rejected 78
posts of which a second pass accepted 40.

The script now asks the model only for observations — `reportedOutcome`,
`actionsTaken`, `isRequestForContacts` — and applies the rule in code
(`holdsExperience`). Same test: 2 flips instead of 8. If you extend this, keep
judgements out of the model's output.

**3. The rejection rule is load-bearing, and generous in one specific direction.**

A post with no outcome *and* no completed action is excluded. This is not
tidiness: a bare question is the closest possible vector match to somebody asking
that same question, so it outranks the stories that contain answers and consumes
one of the three slots an answer has.

But an unresolved situation still counts when the person did something — "I filed
B-2 on day 58 and I am waiting" is real information to somebody on day 55. Do not
tighten this into "must have an outcome".

17 posts are currently excluded and every one is a bare question.

**4. `apps/haven/scripts/community-summaries-skipped.json` is state, not junk.**

Rejected posts write no row, so nothing in the database records that they were
considered. Without this file the daily run re-judges every rejected post every
night. Commit changes to it. Clear it with `--retry-skipped` when the extraction
prompt changes.

**5. The `topic` column is a hard filter in the RPC, not a label.**

A story labelled `h1b` is invisible to a `layoffs` query and vice versa. The
prompt defines those two buckets explicitly — bridge status after a job loss
(B-2, H-4, F-1, 240-day, transferring to a new employer) is `layoffs`;
`job-change` is AC21 with an I-485 pending 180+ days. The h1b/layoffs pair is now
queried together in `service.ts` because the distinction is genuinely thin, but
the other buckets are not, so keep the prompt's definitions if you edit it.

## One thing for you

`scripts/community/daily-reddit-import.py` has uncommitted changes in the working
tree that are not mine. If they are yours, commit them — I have been working
around them all week and they are at risk of being lost.
