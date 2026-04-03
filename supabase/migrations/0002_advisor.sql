create extension if not exists vector;

create type public.advisor_thread_status as enum ('active', 'archived');
create type public.advisor_message_role as enum ('user', 'assistant', 'system');
create type public.advisor_citation_kind as enum ('external', 'haven', 'community');

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  agency text not null,
  base_url text not null,
  topic text not null,
  trust_priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  slug text not null unique,
  title text not null,
  url text not null,
  topic text not null,
  version_label text,
  effective_date date,
  fetched_at timestamptz not null default now(),
  content_hash text not null,
  is_current boolean not null default true,
  body_markdown text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_key text not null,
  chunk_index integer not null,
  token_count integer,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_key)
);

create table public.advisor_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null default 'New conversation',
  status public.advisor_thread_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.advisor_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.advisor_threads(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role public.advisor_message_role not null,
  content text not null,
  answer_payload jsonb,
  retrieval_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.advisor_message_citations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.advisor_messages(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  citation_kind public.advisor_citation_kind not null,
  citation_index integer not null default 0,
  label text not null,
  url text,
  quote text,
  document_id uuid references public.knowledge_documents(id) on delete set null,
  knowledge_chunk_id uuid references public.knowledge_chunks(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.advisor_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.advisor_messages(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  rating smallint not null check (rating between -1 and 1),
  feedback_text text,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table public.source_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_slug text not null,
  status text not null,
  summary text,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_text text
);

create table public.community_advice_summaries (
  id uuid primary key default gen_random_uuid(),
  source_post_id uuid references public.community_posts(id) on delete set null,
  space_id uuid references public.community_spaces(id) on delete set null,
  title text not null,
  topic text not null,
  summary text not null,
  legal_caveat text not null,
  tags text[] not null default '{}',
  moderation_status text not null default 'approved',
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (title)
);

create index knowledge_documents_source_id_idx on public.knowledge_documents(source_id);
create index knowledge_documents_topic_idx on public.knowledge_documents(topic);
create index knowledge_chunks_document_id_idx on public.knowledge_chunks(document_id);
create index advisor_threads_user_id_idx on public.advisor_threads(user_id, updated_at desc);
create index advisor_messages_thread_id_idx on public.advisor_messages(thread_id, created_at asc);
create index advisor_citations_message_id_idx on public.advisor_message_citations(message_id, citation_index asc);
create index community_advice_summaries_space_id_idx on public.community_advice_summaries(space_id);

create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index community_advice_summaries_embedding_idx
  on public.community_advice_summaries
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger advisor_threads_updated_at
before update on public.advisor_threads
for each row
execute function public.set_current_timestamp_updated_at();

create trigger community_advice_summaries_updated_at
before update on public.community_advice_summaries
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  filter_source_slugs text[] default null,
  filter_topics text[] default null
)
returns table (
  id uuid,
  document_id uuid,
  chunk_key text,
  content text,
  topic text,
  url text,
  title text,
  agency text,
  source_slug text,
  similarity double precision
)
language sql
stable
as $$
  select
    kc.id,
    kc.document_id,
    kc.chunk_key,
    kc.content,
    kd.topic,
    kd.url,
    kd.title,
    ks.agency,
    ks.slug as source_slug,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  join public.knowledge_documents kd on kd.id = kc.document_id
  join public.knowledge_sources ks on ks.id = kd.source_id
  where kc.embedding is not null
    and (filter_source_slugs is null or ks.slug = any(filter_source_slugs))
    and (filter_topics is null or kd.topic = any(filter_topics))
  order by kc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.match_community_advice_summaries(
  query_embedding vector(1536),
  match_count integer default 4,
  filter_topics text[] default null
)
returns table (
  id uuid,
  title text,
  topic text,
  summary text,
  legal_caveat text,
  tags text[],
  similarity double precision
)
language sql
stable
as $$
  select
    cas.id,
    cas.title,
    cas.topic,
    cas.summary,
    cas.legal_caveat,
    cas.tags,
    1 - (cas.embedding <=> query_embedding) as similarity
  from public.community_advice_summaries cas
  where cas.embedding is not null
    and cas.moderation_status = 'approved'
    and (filter_topics is null or cas.topic = any(filter_topics))
  order by cas.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.advisor_threads enable row level security;
alter table public.advisor_messages enable row level security;
alter table public.advisor_message_citations enable row level security;
alter table public.advisor_feedback enable row level security;
alter table public.source_sync_runs enable row level security;
alter table public.community_advice_summaries enable row level security;

create policy "knowledge sources are readable"
on public.knowledge_sources for select
using (true);

create policy "knowledge documents are readable"
on public.knowledge_documents for select
using (true);

create policy "knowledge chunks are readable"
on public.knowledge_chunks for select
using (true);

create policy "advisor threads are self-readable"
on public.advisor_threads for select
using (user_id = auth.uid());

create policy "advisor threads are self-insertable"
on public.advisor_threads for insert
with check (user_id = auth.uid());

create policy "advisor threads are self-updatable"
on public.advisor_threads for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "advisor messages are self-readable"
on public.advisor_messages for select
using (user_id = auth.uid());

create policy "advisor messages are self-insertable"
on public.advisor_messages for insert
with check (user_id = auth.uid());

create policy "advisor citations are self-readable"
on public.advisor_message_citations for select
using (user_id = auth.uid());

create policy "advisor citations are self-insertable"
on public.advisor_message_citations for insert
with check (user_id = auth.uid());

create policy "advisor feedback is self-readable"
on public.advisor_feedback for select
using (user_id = auth.uid());

create policy "advisor feedback is self-insertable"
on public.advisor_feedback for insert
with check (user_id = auth.uid());

create policy "advisor feedback is self-updatable"
on public.advisor_feedback for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "community advice summaries are readable"
on public.community_advice_summaries for select
using (moderation_status = 'approved');
