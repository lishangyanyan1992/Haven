create extension if not exists "pgcrypto";

create type public.visa_type as enum ('OPT', 'STEM OPT', 'H1B', 'H4', 'O-1', 'GC', 'Citizen');
create type public.perm_stage as enum ('not_started', 'in_progress', 'certified', 'denied');
create type public.preference_category as enum ('EB-1', 'EB-2', 'EB-3', 'EB-2 NIW', 'Not sure');
create type public.employment_status as enum ('employed', 'actively_searching', 'laid_off');
create type public.spouse_visa_status as enum ('none', 'H1B', 'H4', 'H4 EAD', 'GC', 'other');
create type public.primary_goal as enum ('get_gc', 'job_stability', 'explore_options', 'stay_flexible', 'not_sure');
create type public.concern as enum ('layoffs', 'visa_expiry', 'gc_timeline', 'job_change', 'other');
create type public.readiness_level as enum ('high', 'medium', 'low');
create type public.timeline_group as enum ('past', 'now', 'upcoming', 'future');
create type public.community_space_type as enum ('cohort', 'war_room');
create type public.email_source_type as enum ('i797_notice', 'uscis_receipt', 'attorney_update', 'rfe_notice', 'employer_hr', 'priority_date_update');
create type public.email_record_status as enum ('pending_confirmation', 'accepted', 'rejected');

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  visa_type public.visa_type not null,
  country_of_birth text not null,
  current_visa_expiry_date date,
  h1b_start_date date,
  perm_stage public.perm_stage not null default 'not_started',
  perm_filing_date date,
  i140_approved boolean not null default false,
  i140_approval_date date,
  priority_date date,
  preference_category public.preference_category not null default 'Not sure',
  i485_filed boolean not null default false,
  employer_name text,
  employer_size text,
  employer_industry text,
  job_title text,
  employment_status public.employment_status not null default 'employed',
  spouse_visa_status public.spouse_visa_status not null default 'none',
  primary_goal public.primary_goal not null default 'not_sure',
  top_concerns public.concern[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.derived_signals (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  h1b_cap_date date,
  days_until_visa_expiry integer,
  visa_bulletin_position text,
  estimated_gc_date_range text,
  ac21_portability_status text,
  layoff_readiness_score public.readiness_level not null,
  layoff_readiness_reasoning text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  event_kind text not null,
  event_group public.timeline_group not null,
  title text not null,
  date_label text not null,
  next_action text not null,
  explanation text not null,
  community_link_label text,
  created_at timestamptz not null default now()
);

create table public.community_spaces (
  id uuid primary key default gen_random_uuid(),
  space_type public.community_space_type not null,
  name text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.community_spaces(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  anonymized_label text not null,
  priority_date_range text,
  top_concern public.concern not null,
  created_at timestamptz not null default now(),
  unique (space_id, user_id)
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.community_spaces(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete set null,
  author_label text not null,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.email_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.user_profiles(id) on delete cascade,
  alias text not null unique,
  created_at timestamptz not null default now()
);

create table public.email_ingest_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  alias text not null,
  source_type public.email_source_type not null,
  subject text not null,
  received_at timestamptz not null,
  status public.email_record_status not null default 'pending_confirmation',
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create table public.email_extracted_fields (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.email_ingest_records(id) on delete cascade,
  label text not null,
  value text not null,
  confidence text not null
);

alter table public.user_profiles enable row level security;
alter table public.derived_signals enable row level security;
alter table public.timeline_events enable row level security;
alter table public.community_spaces enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_posts enable row level security;
alter table public.email_aliases enable row level security;
alter table public.email_ingest_records enable row level security;
alter table public.email_extracted_fields enable row level security;

create policy "profiles are self-readable"
on public.user_profiles for select
using (id = auth.uid());

create policy "profiles are self-insertable"
on public.user_profiles for insert
with check (id = auth.uid());

create policy "profiles are self-updatable"
on public.user_profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "derived signals are self-readable"
on public.derived_signals for select
using (user_id = auth.uid());

create policy "derived signals are self-insertable"
on public.derived_signals for insert
with check (user_id = auth.uid());

create policy "derived signals are self-updatable"
on public.derived_signals for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "timeline events are self-readable"
on public.timeline_events for select
using (user_id = auth.uid());

create policy "community spaces are readable"
on public.community_spaces for select
using (true);

create policy "community memberships are self-readable"
on public.community_memberships for select
using (user_id = auth.uid());

create policy "community posts are readable"
on public.community_posts for select
using (true);

create policy "email aliases are self-readable"
on public.email_aliases for select
using (user_id = auth.uid());

create policy "email aliases are self-insertable"
on public.email_aliases for insert
with check (user_id = auth.uid());

create policy "email records are self-readable"
on public.email_ingest_records for select
using (user_id = auth.uid());

create policy "email records are self-updatable"
on public.email_ingest_records for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "email fields are self-readable"
on public.email_extracted_fields for select
using (
  exists (
    select 1
    from public.email_ingest_records
    where email_ingest_records.id = email_extracted_fields.record_id
      and email_ingest_records.user_id = auth.uid()
  )
);
