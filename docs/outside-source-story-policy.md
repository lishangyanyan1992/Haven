# Outside-Source Story Policy

This policy applies whenever Haven collects, imports, rewrites, stages, reviews, or publishes community stories from outside sources such as Reddit, Rednote, forums, social platforms, blogs, comments, or any other non-Haven source.

If a user asks an agent or operator to "pull new stories", "import stories", "add stories to the community", "scrape stories", "collect forum stories", or similar, this is the required process. Do not improvise a shorter path.

The user must specify which outside source to use, such as Reddit or Rednote. If the source is not explicit, stop and ask the user to choose the source before collecting, searching, scraping, importing, or drafting anything. Do not assume a default source.

After the source is explicit, apply `docs/community-story-selection-rubric.md` before importing any candidate story. The rubric defines business-fit criteria for Haven's target audience, value proposition, and product strategy.

## Core Rule

Outside-source stories are never published directly.

They must move through this sequence:

1. Collect outside Haven.
2. Operator review.
3. Source-only dry run.
4. Source-only import into Haven.
5. Haven-generated anonymized draft.
6. Admin review.
7. Publish only approved drafts.
8. Keep imported stories separate from verified first-party or consented stats.

## What Counts As An Outside Source

Treat all of these as outside-source stories:

- Reddit posts and comments
- Rednote/Xiaohongshu posts and comments
- Forum threads
- Social media posts
- Blog comments
- Public Q&A threads
- Screenshots or pasted third-party stories
- Any story not submitted directly to Haven with consent

First-party Haven submissions and user-consented case data are not covered by this policy, but they still require the normal product consent and moderation rules.

## Required Process

### 1. Collect Outside Haven

Use a separate collector or local workflow. The Haven app should not scrape sources inside the public product flow.

Collectors should store raw collection results locally first, such as in a local `stories.db` or reviewed batch file.

Do not write collected stories directly to:

- `community_posts`
- `community_post_comments`
- public aggregate case tables
- production-facing public content files

### 2. Screen Sources Before Import

Only continue with a story if it is relevant, public enough for collection, and useful to the Haven community.

Reject or skip stories when:

- The story appears private, leaked, doxxed, or copied from a closed space.
- The source prohibits reuse in a way Haven cannot honor.
- The story contains highly identifying facts that cannot be safely generalized.
- The story is mostly legal advice from a non-lawyer without useful case experience.
- The story is too vague to preserve meaningful immigration facts.
- The story is mainly harassment, speculation, advertising, or unverifiable claims about a named person.

### 3. Operator Review

Before sending anything to Haven, an operator must review the local collection results.

The operator checks:

- The story is relevant to immigration or adjacent Haven workflows.
- The source URL and `source_story_id` are present.
- The story has enough case context to be useful.
- Obvious usernames, real names, employers, law firms, addresses, receipt numbers, passport details, phone numbers, emails, and other identifiers are not needed for the public version.
- The story should be rewritten, not copied.

### 4. Source-Only Dry Run

Run a dry run from the collector side before writing to Haven.

The dry run should confirm:

- Item count
- Source name
- Unique `source_story_id` values
- Required private payload fields
- No direct `community_posts` write
- No public stats write

### 5. Import Source-Only Payloads

Send reviewed items to Haven through:

`POST /api/internal/community-import`

Use the shape documented in `docs/community-source-import.md`.

The payload should include `source`, `source_story_id`, optional `language`, and `source_payload_private`.

Prefer omitting `publish_draft` so Haven generates the draft server-side. `publish_draft` exists for backward compatibility, not as a shortcut around Haven generation or review.

### 6. Generate A Public Draft Inside Haven

Haven generates a `publish_draft` and stages it in `community_import_items`.

The generated draft must:

- Preserve the key immigration facts, timeline logic, actions taken, outcome, and practical lessons.
- Be less identifiable than the source.
- Avoid copying source phrasing.
- Optimize titles, bodies, tags, and comments for relevant search intent without keyword stuffing or adding unsupported facts.
- Rewrite comments instead of quoting them.
- Remove usernames, links, edit notes, and source-specific formatting unless there is a clear reason to keep a generalized fact.
- Use calm, practical forum language.
- Include only tags directly supported by the source.
- Include privacy and moderation flags when there is risk.
- Mark `publish_ready=false` when privacy risk or factual ambiguity is too high.

### 7. Admin Review Before Publishing

Imports must stay staged until reviewed.

Admin review decides whether to:

- Publish
- Reject
- Revise and re-review
- Keep staged for later

The import API must not publish directly to `community_posts`. Publishing remains behind admin review actions.

### 8. Public Publishing Rules

Published outside-source stories must:

- Use anonymized author labels.
- Avoid source usernames and source-specific identity signals.
- Avoid verbatim copying.
- Carry the legal caveat: "Community experience only, not legal advice."
- Be framed as community experience, not verified legal guidance.
- Preserve useful case context without exposing private details.

### 9. Stats And Data Separation

Outside-source imported stories are not verified Haven outcomes.

Do not count imported forum stories in public aggregate stats unless there is a later explicit consent and verification path.

Prototype extracted rows must remain tagged as imported/test data, such as:

- `source='imported_prototype'`
- `verification='forum_imported'`

Aggregate public statistics should use only approved first-party or consented sources.

### 10. Observability

Haven should trace import receipt, draft generation, staging, admin review, publish actions, and reject actions through the story observability pipeline when configured.

Local scraping itself is intentionally not traced in Langfuse.

## Required Checklist For New Story Pulls

Before beginning:

- [ ] Read this policy.
- [ ] Read `docs/community-source-import.md`.
- [ ] Read `docs/community-story-selection-rubric.md`.
- [ ] Confirm the user explicitly specified the outside source, such as Reddit or Rednote.
- [ ] Confirm the requested source is an outside source.
- [ ] Confirm collection will not write directly to public tables.

Before import:

- [ ] Operator reviewed the collected stories.
- [ ] Each item has a stable `source_story_id`.
- [ ] Each item has a source URL or source locator.
- [ ] High-risk private or identifying stories were removed.
- [ ] A source-only dry run completed.

During import:

- [ ] Use `POST /api/internal/community-import`.
- [ ] Send source-only payloads.
- [ ] Deduplicate by `source + source_story_id`.
- [ ] Stage into `community_import_items`.
- [ ] Do not publish directly.

Before publishing:

- [ ] Confirm generated drafts are meaning-preserving.
- [ ] Confirm drafts are not too similar to source wording.
- [ ] Confirm comments are rewritten.
- [ ] Confirm privacy and moderation flags are resolved.
- [ ] Confirm admin approval.

After publishing:

- [ ] Confirm public post author labels are anonymous.
- [ ] Confirm legal caveat is present.
- [ ] Confirm imported stories were not added to verified public stats.
- [ ] Confirm trace/review metadata exists when observability is configured.

## Hard Stops

Stop and ask for review instead of continuing if:

- The user did not specify which outside source to use.
- The user asks to publish directly from scraped content.
- The user asks to bypass admin review.
- The source appears private or restricted.
- A story contains identifiers that cannot be safely generalized.
- The only available path would copy source text verbatim.
- The import would affect public aggregate stats.
- Required secrets or API configuration are missing.

## Related Files

- `docs/community-source-import.md`
- `apps/haven/src/app/api/internal/community-import/route.ts`
- `apps/haven/src/server/community-import-actions.ts`
- `scripts/community/import-curated-stories.mjs`
- `scripts/community/extract-case-data-points.mjs`
