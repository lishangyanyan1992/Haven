alter table public.community_import_runs
  add column if not exists langfuse_trace_id text,
  add column if not exists observability_metadata jsonb not null default '{}'::jsonb;

alter table public.community_import_items
  add column if not exists langfuse_trace_id text,
  add column if not exists observability_metadata jsonb not null default '{}'::jsonb;

create index if not exists community_import_runs_langfuse_trace_id_idx
  on public.community_import_runs(langfuse_trace_id)
  where langfuse_trace_id is not null;

create index if not exists community_import_items_langfuse_trace_id_idx
  on public.community_import_items(langfuse_trace_id)
  where langfuse_trace_id is not null;
