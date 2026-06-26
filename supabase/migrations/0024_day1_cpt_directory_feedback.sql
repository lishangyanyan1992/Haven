-- 0024_day1_cpt_directory_feedback.sql
-- Public intake for Day 1 CPT school comments and consultant listing requests.
-- Rows are written by server actions with the service role and held for moderation.

create table if not exists public.day1_cpt_directory_feedback (
  id uuid primary key default gen_random_uuid(),
  feedback_kind text not null,
  school_id text,
  school_name text,
  organization_name text,
  organization_website text,
  organization_domain text,
  services text,
  relationship text not null default 'student',
  submitter_email text,
  comment text not null,
  moderation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint day1_cpt_feedback_kind_chk
    check (feedback_kind in ('school_comment', 'consultant_listing')),
  constraint day1_cpt_feedback_relationship_chk
    check (relationship in ('student', 'alum', 'applicant', 'school_staff', 'consultant', 'other')),
  constraint day1_cpt_feedback_moderation_chk
    check (moderation_status in ('pending', 'approved', 'rejected')),
  constraint day1_cpt_feedback_comment_len_chk
    check (char_length(comment) between 12 and 3000),
  constraint day1_cpt_school_comment_chk
    check (
      feedback_kind <> 'school_comment'
      or (school_id is not null and school_name is not null)
    ),
  constraint day1_cpt_consultant_listing_chk
    check (
      feedback_kind <> 'consultant_listing'
      or (organization_name is not null and organization_website is not null and submitter_email is not null)
    )
);

create index if not exists day1_cpt_feedback_school_idx
  on public.day1_cpt_directory_feedback (school_id, created_at desc);

create index if not exists day1_cpt_feedback_kind_idx
  on public.day1_cpt_directory_feedback (feedback_kind, moderation_status, created_at desc);

drop trigger if exists day1_cpt_directory_feedback_updated_at on public.day1_cpt_directory_feedback;
create trigger day1_cpt_directory_feedback_updated_at
before update on public.day1_cpt_directory_feedback
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.day1_cpt_directory_feedback enable row level security;

