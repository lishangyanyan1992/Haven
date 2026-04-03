-- Stores a user's active or resolved layoff event
create table public.layoff_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activated_at timestamptz not null default now(),
  layoff_date date not null,
  employer_at_layoff text,
  visa_type_at_layoff text,
  resolved_at timestamptz,
  resolution_type text check (resolution_type in ('new_job', 'change_status', 'left_country', 'dismissed')),
  created_at timestamptz not null default now()
);

-- Only one active (unresolved) event per user at a time
create unique index one_active_event_per_user
  on public.layoff_events (user_id)
  where resolved_at is null;

-- Tracks which checklist items the user has completed
create table public.layoff_checklist_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.layoff_events(id) on delete cascade,
  item_key text not null,
  completed_at timestamptz not null default now(),
  unique (event_id, item_key)
);

-- RLS
alter table public.layoff_events enable row level security;
alter table public.layoff_checklist_completions enable row level security;

create policy "Users own their layoff events"
  on public.layoff_events for all
  using (auth.uid() = user_id);

create policy "Users own their checklist completions"
  on public.layoff_checklist_completions for all
  using (auth.uid() = user_id);
