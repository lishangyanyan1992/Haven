-- 0023_legal_firm_claims.sql
-- Firm claim / apply intake for the legal directory. A firm either CLAIMS an
-- existing listing or APPLIES to be added (free). Rows start 'pending'; the
-- public site only renders rows once an admin flips status to 'claimed' (a
-- one-click change in the Supabase dashboard). Mirrors the feedback tables
-- (0020/0022). Written by server actions with the service role.

create table if not exists public.legal_firm_claims (
  id uuid primary key default gen_random_uuid(),
  claim_type text not null,                 -- 'claim' | 'apply'
  firm_id text,                             -- existing listing id; null for 'apply'
  firm_name text not null,
  status text not null default 'pending',   -- 'pending' | 'claimed' | 'rejected'

  -- Identity (review-only, not displayed publicly)
  claimant_name text,
  claimant_role text,
  claimant_email text,
  claimant_phone text,
  email_domain_match boolean not null default false,

  -- Credentials surfaced for review + display (firm-stated, not Haven-verified)
  bar_number text,
  bar_state text,

  -- Evidence links (shown publicly as "firm-provided proof")
  evidence_bar_url text,
  evidence_aila_url text,
  evidence_specialist_url text,
  evidence_website text,

  -- Everything else displayed on a claimed profile (visa types, hard cases,
  -- languages, pricing, booking url, bio, and base fields for 'apply' firms).
  profile jsonb not null default '{}'::jsonb,

  attested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint legal_firm_claims_type_chk
    check (claim_type in ('claim', 'apply')),
  constraint legal_firm_claims_status_chk
    check (status in ('pending', 'claimed', 'rejected')),
  constraint legal_firm_claims_firm_name_len_chk
    check (char_length(firm_name) between 1 and 180)
);

create index if not exists legal_firm_claims_status_idx
  on public.legal_firm_claims (status, created_at desc);

create index if not exists legal_firm_claims_firm_idx
  on public.legal_firm_claims (firm_id, status);

drop trigger if exists legal_firm_claims_updated_at on public.legal_firm_claims;
create trigger legal_firm_claims_updated_at
before update on public.legal_firm_claims
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.legal_firm_claims enable row level security;
