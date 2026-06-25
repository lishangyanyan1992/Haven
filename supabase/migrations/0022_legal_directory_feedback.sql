-- 0022_legal_directory_feedback.sql
-- Public intake for legal-directory (immigration law firm) comments and
-- missing-firm suggestions. Rows are written by server actions with the service
-- role and held for moderation. Mirrors sponsor_directory_feedback (0020/0021).

create table if not exists public.legal_directory_feedback (
  id uuid primary key default gen_random_uuid(),
  feedback_kind text not null,
  firm_id text,
  firm_name text not null,
  firm_website text,
  firm_domain text,
  relationship text not null default 'client',
  submitter_email text,
  comment text not null,
  moderation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint legal_directory_feedback_kind_chk
    check (feedback_kind in ('firm_comment', 'new_firm')),
  constraint legal_directory_feedback_relationship_chk
    check (relationship in ('client', 'prospective_client', 'attorney', 'referral', 'other')),
  constraint legal_directory_feedback_moderation_chk
    check (moderation_status in ('pending', 'approved', 'rejected')),
  constraint legal_directory_feedback_comment_len_chk
    check (char_length(comment) between 12 and 2000),
  constraint legal_directory_feedback_firm_name_len_chk
    check (char_length(firm_name) between 1 and 180)
);

create index if not exists legal_directory_feedback_firm_idx
  on public.legal_directory_feedback (firm_id, created_at desc);

create index if not exists legal_directory_feedback_moderation_idx
  on public.legal_directory_feedback (moderation_status, created_at desc);

drop trigger if exists legal_directory_feedback_updated_at on public.legal_directory_feedback;
create trigger legal_directory_feedback_updated_at
before update on public.legal_directory_feedback
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.legal_directory_feedback enable row level security;
