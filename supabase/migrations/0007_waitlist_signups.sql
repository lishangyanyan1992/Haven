create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  normalized_email text not null,
  interest_key text not null,
  interest_label text not null,
  source_path text not null default '/',
  metadata jsonb not null default '{}'::jsonb,
  unique (normalized_email, interest_key, source_path)
);

create index waitlist_signups_created_at_idx on public.waitlist_signups(created_at desc);
create index waitlist_signups_interest_idx on public.waitlist_signups(interest_key, created_at desc);

alter table public.waitlist_signups enable row level security;
