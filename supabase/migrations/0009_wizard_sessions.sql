create table if not exists public.wizard_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filing_slug text not null,
  wizard_state jsonb not null default '{}'::jsonb,
  supplements jsonb not null default '{}'::jsonb,
  current_step integer not null default 1,
  started_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, filing_slug)
);

alter table public.wizard_sessions enable row level security;

create policy "wizard_sessions_select_own"
on public.wizard_sessions
for select
using (auth.uid() = user_id);

create policy "wizard_sessions_insert_own"
on public.wizard_sessions
for insert
with check (auth.uid() = user_id);

create policy "wizard_sessions_update_own"
on public.wizard_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "wizard_sessions_delete_own"
on public.wizard_sessions
for delete
using (auth.uid() = user_id);
