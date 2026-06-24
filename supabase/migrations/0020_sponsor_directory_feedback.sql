-- 0020_sponsor_directory_feedback.sql
-- Public intake for sponsor-directory comments and missing-company suggestions.
-- Rows are written by server actions with the service role and held for moderation.

create table if not exists public.sponsor_directory_feedback (
  id uuid primary key default gen_random_uuid(),
  feedback_kind text not null,
  company_id text,
  company_name text not null,
  relationship text not null default 'candidate',
  submitter_email text,
  comment text not null,
  moderation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sponsor_directory_feedback_kind_chk
    check (feedback_kind in ('company_comment', 'new_company')),
  constraint sponsor_directory_feedback_relationship_chk
    check (relationship in ('candidate', 'employee', 'former_employee', 'recruiter', 'immigration_team', 'other')),
  constraint sponsor_directory_feedback_moderation_chk
    check (moderation_status in ('pending', 'approved', 'rejected')),
  constraint sponsor_directory_feedback_comment_len_chk
    check (char_length(comment) between 12 and 2000),
  constraint sponsor_directory_feedback_company_name_len_chk
    check (char_length(company_name) between 1 and 180)
);

create index if not exists sponsor_directory_feedback_company_idx
  on public.sponsor_directory_feedback (company_id, created_at desc);

create index if not exists sponsor_directory_feedback_moderation_idx
  on public.sponsor_directory_feedback (moderation_status, created_at desc);

drop trigger if exists sponsor_directory_feedback_updated_at on public.sponsor_directory_feedback;
create trigger sponsor_directory_feedback_updated_at
before update on public.sponsor_directory_feedback
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.sponsor_directory_feedback enable row level security;
