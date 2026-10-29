-- Details read from documents, and where each profile value came from.
--
-- 0031 cut fact extraction before launch. It returns here in a narrow form: a
-- fixed list of details per document type, filled automatically, with every
-- filled value labeled with its source so people can check and change it.
--
-- Lawyers read these through the server (admin client + the firm-client access
-- check in lib/firms), the same way they read documents, so RLS here is
-- owner-only.

-- Which green card a sponsor-tied document belongs to. Green cards live as JSON
-- in user_profiles.deadline_answers.immigrantPetitions, so this is the
-- petition's id string, not a foreign key.
alter table public.user_documents
  add column if not exists petition_id text;

create table if not exists public.document_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  document_id uuid not null references public.user_documents(id) on delete cascade,
  -- From the fixed catalog, e.g. 'i140.priority_date'.
  fact_key text not null,
  -- Normalized value (ISO date, receipt number, category). Null when unreadable.
  value text,
  -- Exactly what was read, shown when Haven wasn't sure.
  raw_text text,
  page integer check (page is null or page > 0),
  confident boolean not null default false,
  -- Field key it was written to, e.g. 'priorityDate' or 'petition:<id>.priorityDate'.
  applied_to text,
  state text not null default 'needs_check'
    check (state in ('filled', 'needs_check', 'not_used_person_value', 'not_used_record_removed', 'no_target')),
  created_at timestamptz not null default now(),
  unique (document_id, fact_key)
);

create index if not exists document_facts_user_idx on public.document_facts(user_id);

create table if not exists public.field_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  field_key text not null,
  origin text not null check (origin in ('document', 'person', 'document_deleted')),
  -- The value the field holds now, as a string.
  value text,
  document_fact_id uuid references public.document_facts(id) on delete set null,
  -- Set when a person's value differs from a document's.
  document_value text,
  -- Label of the document behind document_value, kept so it survives deletion.
  document_label text,
  document_page integer,
  resolution text check (resolution is null or resolution in ('open', 'kept_mine')),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (user_id, field_key)
);

create index if not exists field_sources_open_idx
  on public.field_sources(user_id)
  where resolution is not null;

alter table public.document_facts enable row level security;
alter table public.field_sources enable row level security;

-- Readable by the owner. Written only by the server.
drop policy if exists "document facts are self-readable" on public.document_facts;
create policy "document facts are self-readable"
on public.document_facts for select
using (user_id = auth.uid());

drop policy if exists "field sources are self-readable" on public.field_sources;
create policy "field sources are self-readable"
on public.field_sources for select
using (user_id = auth.uid());
