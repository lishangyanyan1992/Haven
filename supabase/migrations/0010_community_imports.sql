create table if not exists public.community_import_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null default 'received',
  item_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  duplicate_count integer not null default 0,
  notes text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.community_import_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.community_import_runs(id) on delete set null,
  source text not null,
  source_story_id text not null,
  language text,
  source_payload_private jsonb not null default '{}'::jsonb,
  publish_draft jsonb not null default '{}'::jsonb,
  moderation_status text not null default 'pending',
  moderation_notes text,
  approved_at timestamptz,
  approved_by uuid references public.user_profiles(id) on delete set null,
  rejected_at timestamptz,
  published_post_id uuid references public.community_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_story_id)
);

create index if not exists community_import_items_run_id_idx
  on public.community_import_items(run_id);

create index if not exists community_import_items_status_idx
  on public.community_import_items(moderation_status, created_at desc);

drop trigger if exists community_import_items_updated_at on public.community_import_items;
create trigger community_import_items_updated_at
before update on public.community_import_items
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.community_import_runs enable row level security;
alter table public.community_import_items enable row level security;
