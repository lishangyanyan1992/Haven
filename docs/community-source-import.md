# Community Source Import

For the full policy and required checklist for outside-source stories, read `docs/outside-source-story-policy.md` first. For business-fit criteria, read `docs/community-story-selection-rubric.md`. Both documents are mandatory whenever an agent or operator is asked to pull, collect, scrape, import, add, or publish community stories from outside sources.

Agents and operators must not assume a source. The user must specify which source to use, such as Reddit or Rednote; if not, ask before collecting or importing stories.

Haven owns public story generation, moderation, and publishing. External collectors should send source-only import payloads to the internal community import API, then Haven generates and stages a `publish_draft` in `community_import_items`.

The import API must not publish directly to `community_posts`. Publishing stays behind admin review actions.

## Source-Only Payload

`POST /api/internal/community-import`

Headers:

```http
Authorization: Bearer $COMMUNITY_IMPORT_SECRET
Content-Type: application/json
```

Body:

```json
{
  "source": "rednote",
  "items": [
    {
      "source_story_id": "rednote:abc123",
      "language": "zh",
      "source_payload_private": {
        "title": "Source title",
        "body": "Original or translated body",
        "comments": [],
        "case_brief": {},
        "source_url": "https://example.com/private-source"
      }
    }
  ]
}
```

`publish_draft` is optional for backward compatibility. If omitted, Haven generates the draft server-side using OpenAI and stores both the private source payload and generated draft in `community_import_items`.

## Observability

Story import tracing uses the story Langfuse project:

```bash
LANGFUSE_STORY_SECRET_KEY=
LANGFUSE_STORY_PUBLIC_KEY=
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

Traced events include import receipt, draft generation, staging, admin review, and publish/reject actions. Local scraping is intentionally not traced in Langfuse.

## Manual Flow

1. Collector repo scrapes into its local `stories.db`.
2. Operator reviews local stories.
3. Operator runs a source-only dry run from the collector repo.
4. Operator sends the reviewed source-only payload to Haven.
5. Haven generates and stages drafts in `community_import_items`.
6. Admin review publishes approved rows into `community_posts` and `community_post_comments`.
