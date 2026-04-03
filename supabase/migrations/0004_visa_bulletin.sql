create table public.visa_bulletin_entries (
  id uuid primary key default gen_random_uuid(),
  bulletin_year integer not null,
  bulletin_month integer not null check (bulletin_month between 1 and 12),
  category text not null,
  country text not null,
  cutoff_label text not null,
  cutoff_date date,
  source_url text not null,
  created_at timestamptz not null default now(),
  unique (bulletin_year, bulletin_month, category, country)
);

create index visa_bulletin_entries_lookup_idx
  on public.visa_bulletin_entries (category, country, bulletin_year desc, bulletin_month desc);

alter table public.visa_bulletin_entries enable row level security;

create policy "visa bulletin entries are readable"
on public.visa_bulletin_entries for select
using (auth.role() = 'authenticated');
