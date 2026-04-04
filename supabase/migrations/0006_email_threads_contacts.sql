-- Contact role labels users can apply to senders
create type public.contact_role as enum (
  'hr',
  'lawyer',
  'associated_company',
  'uscis',
  'recruiter',
  'other'
);

-- Contacts: one row per unique sender email per user
create table public.email_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  email text not null,
  name text,
  role public.contact_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, email)
);

-- Threads: groups of emails with the same normalized subject
create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  thread_key text not null,   -- normalized subject (Re:/Fwd: stripped, lowercased)
  subject text not null,       -- first seen subject for display
  last_email_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, thread_key)
);

-- Add sender, body, thread, and contact columns to existing email records
alter table public.email_ingest_records
  add column sender_email text,
  add column sender_name text,
  add column body_text text,
  add column thread_id uuid references public.email_threads(id) on delete set null,
  add column contact_id uuid references public.email_contacts(id) on delete set null;

-- Indexes for common lookups
create index on public.email_contacts (user_id);
create index on public.email_threads (user_id, last_email_at desc);
create index on public.email_ingest_records (thread_id);
create index on public.email_ingest_records (contact_id);

-- RLS
alter table public.email_contacts enable row level security;
alter table public.email_threads enable row level security;

create policy "contacts are self-readable"
on public.email_contacts for select
using (user_id = auth.uid());

create policy "contacts are self-insertable"
on public.email_contacts for insert
with check (user_id = auth.uid());

create policy "contacts are self-updatable"
on public.email_contacts for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "threads are self-readable"
on public.email_threads for select
using (user_id = auth.uid());

create policy "threads are self-insertable"
on public.email_threads for insert
with check (user_id = auth.uid());

create policy "threads are self-updatable"
on public.email_threads for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
