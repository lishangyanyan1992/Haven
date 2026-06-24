-- 0017_community_case_data_points.sql
-- Structured, countable counterpart to the prose community_advice_summaries (0002_advisor.sql).
-- Purely additive: creates one new table + indexes + trigger + RLS. Alters nothing existing.
-- The aggregation RPC (aggregate_case_outcomes) is added in a later migration (build step 3).

create table if not exists public.community_case_data_points (
  id uuid primary key default gen_random_uuid(),

  -- segment (the "people like me" filter axes; coarse buckets, not raw values)
  current_status text not null,             -- h1b | f1_opt | l1 | other
  green_card_stage text,                    -- none | perm | i140_pending | i140_approved | i485_filed
  i140_status text,                         -- none | pending | approved (denormalized for fast filter)
  category text,                            -- eb1 | eb2 | eb3 | unknown
  nationality_bucket text,                  -- india | china | row
  priority_date date,
  priority_date_position text,              -- current | backlogged | unknown
  trigger text,                             -- laid_off | quit | opt_ending | other
  days_in_grace_bucket text,

  -- action (the headline field: "60% did X")
  path_taken text not null,                 -- h1b_transfer | h4_cos | b2_cos | o1 | consular | departed | day1_cpt | undecided

  -- outcome
  outcome text,                             -- approved | denied | rfe | noid | pending
  got_rfe boolean,
  got_noid boolean,

  -- timing (deltas derived server-side from raw dates)
  premium_processing boolean,
  time_to_file_days integer,
  time_to_decision_days integer,

  -- qualitative (the one free-text field; optional embedding for "show a relevant story")
  notes text,
  notes_embedding vector(1536),

  -- provenance / trust / recency
  source text not null default 'consented',           -- first_party | consented | imported_prototype
  verification text not null default 'self_reported', -- email_extracted | self_reported | forum_imported
  case_date date,                           -- latest event date, used for recency weighting
  contributor_user_id uuid references public.user_profiles(id) on delete set null,  -- identity hook (cheap now)
  moderation_status text not null default 'pending',  -- pending | approved | rejected
  consented_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ccdp_current_status_chk check (current_status in ('h1b','f1_opt','l1','other')),
  constraint ccdp_path_chk check (
    path_taken in ('h1b_transfer','h4_cos','b2_cos','o1','consular','departed','day1_cpt','undecided')
  ),
  constraint ccdp_outcome_chk check (
    outcome is null or outcome in ('approved','denied','rfe','noid','pending')
  ),
  constraint ccdp_source_chk check (source in ('first_party','consented','imported_prototype')),
  constraint ccdp_verification_chk check (
    verification in ('email_extracted','self_reported','forum_imported')
  ),
  constraint ccdp_moderation_chk check (moderation_status in ('pending','approved','rejected'))
);

-- Aggregation query pattern: filter by segment, scoped to launch-eligible rows only.
create index if not exists community_case_dp_segment_idx
  on public.community_case_data_points (current_status, i140_status, nationality_bucket, category)
  where moderation_status = 'approved' and source in ('first_party','consented');

create index if not exists community_case_dp_case_date_idx
  on public.community_case_data_points (case_date desc);

create index if not exists community_case_dp_contributor_idx
  on public.community_case_data_points (contributor_user_id);

-- Semantic retrieval over the qualitative note (matches the ivfflat pattern in 0002_advisor.sql).
create index if not exists community_case_dp_notes_embedding_idx
  on public.community_case_data_points
  using ivfflat (notes_embedding vector_cosine_ops)
  with (lists = 100);

-- Reuse the shared updated_at trigger function (defined in 0002_advisor.sql).
drop trigger if exists community_case_data_points_updated_at on public.community_case_data_points;
create trigger community_case_data_points_updated_at
before update on public.community_case_data_points
for each row
execute function public.set_current_timestamp_updated_at();

-- Privacy keystone: RLS on, with NO public read/write policy.
-- Raw rows are reachable only by the service role (server actions) and the future
-- aggregate_case_outcomes() security-definer function, which returns k-anonymous aggregates only.
alter table public.community_case_data_points enable row level security;
