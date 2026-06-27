# Haven Agent Instructions

## Outside-Source Community Stories

When a user asks to pull, collect, scrape, import, add, or publish community stories from outside sources, agents must follow `docs/outside-source-story-policy.md`, `docs/community-story-selection-rubric.md`, and `docs/community-source-import.md`.

The user must explicitly specify the outside source, such as Reddit or Rednote. If the source is unclear, ask which source to use before doing any collection, search, scraping, import, or draft work. Do not assume a default source.

Do not publish outside-source stories directly to `community_posts` or `community_post_comments`. Do not write imported outside-source stories into verified public stats. Use the source-only import flow, stage drafts in `community_import_items`, and leave publishing behind admin review.

If the requested workflow conflicts with the policy, stop and explain the conflict before taking action.
