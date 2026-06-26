-- 0025_day1_cpt_school_suggestion.sql
-- Add a public "suggest a school" intake kind to the Day 1 CPT feedback table.
-- Suggestions reuse school_name (suggested name) + organization_website (the
-- school's site) and are held as 'pending' for manual approval.

alter table public.day1_cpt_directory_feedback
  drop constraint if exists day1_cpt_feedback_kind_chk;

alter table public.day1_cpt_directory_feedback
  add constraint day1_cpt_feedback_kind_chk
  check (feedback_kind in ('school_comment', 'consultant_listing', 'school_suggestion'));

alter table public.day1_cpt_directory_feedback
  drop constraint if exists day1_cpt_school_suggestion_chk;

alter table public.day1_cpt_directory_feedback
  add constraint day1_cpt_school_suggestion_chk
  check (
    feedback_kind <> 'school_suggestion'
    or (school_name is not null and organization_website is not null)
  );
