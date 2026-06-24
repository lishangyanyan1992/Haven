-- 0018_community_import_items_unified_intake.sql
-- Generalize community_import_items into the single "intake / front door" for ALL sources
-- (scraped, user-submitted form, email-ingested). Backward-compatible:
--   * only ADDs columns (no drop / rename / type change)
--   * source_type defaults to 'scrape', so existing rows backfill correctly AND the current
--     import pipeline keeps working unchanged (it just gets labeled 'scrape')
--   * the existing `source` column (platform: reddit/rednote/...) is untouched
-- Note: `source` = specific origin/platform; `source_type` = pipeline category.

alter table public.community_import_items
  add column if not exists source_type text not null default 'scrape',           -- scrape | user_form | email
  add column if not exists contributor_user_id uuid references public.user_profiles(id) on delete set null, -- identity hook
  add column if not exists consent_at timestamptz;                                -- when the contributor consented (form/email)

-- Validate allowed categories (idempotent). All existing rows are 'scrape' via the default, so this passes.
alter table public.community_import_items
  drop constraint if exists community_import_items_source_type_chk;
alter table public.community_import_items
  add constraint community_import_items_source_type_chk
  check (source_type in ('scrape','user_form','email'));

-- Lookups by contributor (for later identity resolution / "claim your story").
create index if not exists community_import_items_contributor_idx
  on public.community_import_items (contributor_user_id);
