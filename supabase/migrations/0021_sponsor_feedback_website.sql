-- 0021_sponsor_feedback_website.sql
-- Capture the submitted website URL for new-company suggestions so moderators can
-- review it, and store the normalized root domain used for duplicate detection.
-- The dedup check itself runs in the server action against the sponsor-directory
-- JSON; these columns persist what the user submitted for later review / analytics.

alter table public.sponsor_directory_feedback
  add column if not exists company_website text,
  add column if not exists company_domain text;