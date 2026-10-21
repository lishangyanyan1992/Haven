-- Document context: the chat answers from the user's own documents.
--
-- 0030 added a larger design (facts extracted one by one, a review step, writes
-- to the profile). It was cut back before launch to the simplest useful thing:
-- documents are turned into searchable passages, and the Advisor looks up the
-- passages relevant to each question and cites the document and page.
--
-- Kept from 0030: the per-document reading status, the daily page usage table
-- and its reserve function. Removed: the facts table and the profile columns
-- that only the review flow used. Both were empty — the feature never shipped.

drop table if exists public.document_facts;

alter table public.user_profiles
  drop column if exists document_reading_enabled,
  drop column if exists document_reading_enabled_at,
  drop column if exists document_sourced_fields;

-- 'pending' still means "read me"; nothing reads 'not_requested' any more but
-- it stays valid so older rows need no rewrite.

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  document_id uuid not null references public.user_documents(id) on delete cascade,
  -- 1-based page the passage was read from, so an answer can cite it.
  page integer not null check (page > 0),
  -- Order of the passage within its document, for stable display and dedupe.
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  -- Same model and size as knowledge_chunks (text-embedding-3-small).
  embedding vector(1536) not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- Searches are always for one user, whose set is small, so a plain index on the
-- owner beats an approximate vector index here.
create index document_chunks_user_idx on public.document_chunks(user_id);

alter table public.document_chunks enable row level security;

-- Readable by the owner. Written only by the server's reader, so there is no
-- insert or update policy for users.
create policy "document chunks are self-readable"
on public.document_chunks for select
using (user_id = auth.uid());

create policy "document chunks are self-deletable"
on public.document_chunks for delete
using (user_id = auth.uid());

-- The one way the chat reads documents. It takes the user id explicitly and is
-- callable only with the server key, so a question can only ever search the
-- documents of the person asking — the server passes the signed-in user's id.
create or replace function public.match_document_chunks(
  p_user_id uuid,
  query_embedding vector(1536),
  match_count integer default 5,
  min_similarity double precision default 0.25
)
returns table (
  id uuid,
  document_id uuid,
  document_label text,
  page integer,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dc.id,
    dc.document_id,
    ud.display_label as document_label,
    dc.page,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  join public.user_documents ud on ud.id = dc.document_id
  where dc.user_id = p_user_id
    and ud.user_id = p_user_id
    and 1 - (dc.embedding <=> query_embedding) >= min_similarity
  order by dc.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 10);
$$;

revoke all on function public.match_document_chunks(uuid, vector, integer, double precision) from public, anon, authenticated;
