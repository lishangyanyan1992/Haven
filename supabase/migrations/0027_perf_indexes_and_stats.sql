-- 0027_perf_indexes_and_stats.sql
-- Performance pass following the 2026-07-20 plan-limit incident. Three groups,
-- all additive and reversible (drop index / re-analyze):
--
--   1. community_posts(created_at desc) — the public /community feed now runs
--      `order by created_at desc limit 100` on every ISR revalidation, and had
--      no supporting index (seq scan + sort). Trivial at 146 rows, not at 10k.
--   2. Foreign keys with no leading index (16 of them). These matter more than
--      normal FK hygiene here because nearly every one is a `user_id` column
--      that RLS filters on (`user_id = auth.uid()`), so the index serves both
--      the constraint and every row-level-security check on the table.
--   3. ANALYZE the community tables. community_spaces had never been analyzed
--      (planner saw 0 rows for a populated table) and community_posts had not
--      been analyzed since 2026-07-08.
--
-- Plain (non-concurrent) CREATE INDEX is intentional: every table here is
-- under ~300 rows, so the lock is momentary, and CONCURRENTLY cannot run
-- inside the transaction block that migrations execute in.

-- 1. Feed ordering ------------------------------------------------------------
create index if not exists community_posts_created_at_idx
  on public.community_posts (created_at desc);

-- 2. Unindexed foreign keys ---------------------------------------------------
-- Community
create index if not exists community_posts_space_id_idx
  on public.community_posts (space_id);
create index if not exists community_posts_user_id_idx
  on public.community_posts (user_id);
create index if not exists community_post_comments_user_id_idx
  on public.community_post_comments (user_id);
create index if not exists community_memberships_user_id_idx
  on public.community_memberships (user_id);
create index if not exists community_advice_summaries_source_post_id_idx
  on public.community_advice_summaries (source_post_id);
create index if not exists community_import_items_approved_by_idx
  on public.community_import_items (approved_by);
create index if not exists community_import_items_published_post_id_idx
  on public.community_import_items (published_post_id);

-- Advisor
create index if not exists advisor_messages_user_id_idx
  on public.advisor_messages (user_id);
create index if not exists advisor_message_citations_user_id_idx
  on public.advisor_message_citations (user_id);
create index if not exists advisor_message_citations_document_id_idx
  on public.advisor_message_citations (document_id);
create index if not exists advisor_message_citations_knowledge_chunk_id_idx
  on public.advisor_message_citations (knowledge_chunk_id);
create index if not exists advisor_feedback_user_id_idx
  on public.advisor_feedback (user_id);

-- Timeline / layoff
create index if not exists timeline_events_user_id_idx
  on public.timeline_events (user_id);
create index if not exists layoff_checklist_completions_user_id_idx
  on public.layoff_checklist_completions (user_id);

-- Email ingest
create index if not exists email_ingest_records_user_id_idx
  on public.email_ingest_records (user_id);
create index if not exists email_extracted_fields_record_id_idx
  on public.email_extracted_fields (record_id);

-- 3. Refresh planner statistics ----------------------------------------------
analyze public.community_spaces;
analyze public.community_posts;
analyze public.community_post_comments;
