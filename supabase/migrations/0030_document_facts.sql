-- Document facts: what Haven read off the user's own uploaded documents.
--
-- The vault has stored files since 0005 but never looked inside them. This adds
-- the reading half, on the same terms as advisor_remembered_facts (0029): every
-- row is evidence, not a conclusion. Each fact keeps the exact line it came from
-- and the page, and starts unconfirmed. Nothing here reaches the profile or the
-- Advisor until the user has checked it against that line.
--
-- Reading is opt-in. Contents are sent to the AI provider to be read, and a
-- passport page is not something to send on someone's behalf by default.

-- ── Opt-in, and which profile fields came from a document ─────────────────────

alter table public.user_profiles
  add column document_reading_enabled boolean not null default false,
  add column document_reading_enabled_at timestamptz,
  -- field -> { "documentLabel": text, "documentId": uuid, "page": int, "sourceRemoved": bool }
  -- Kept on the profile, not on the fact, because the fact is deleted with its
  -- document while the profile value deliberately survives. Without this the
  -- profile would quietly forget where a value came from.
  add column document_sourced_fields jsonb not null default '{}'::jsonb;

-- ── Per-document reading state ────────────────────────────────────────────────

alter table public.user_documents
  add column reading_status text not null default 'not_requested'
    check (reading_status in ('not_requested', 'pending', 'reading', 'done', 'failed', 'deferred')),
  -- A short, user-facing reason when reading_status = 'failed'.
  add column reading_error text,
  add column reading_started_at timestamptz,
  add column read_at timestamptz,
  add column page_count integer check (page_count is null or page_count > 0);

create index user_documents_reading_queue_idx
  on public.user_documents(reading_status, uploaded_at)
  where reading_status in ('pending', 'deferred', 'reading');

-- ── The facts ─────────────────────────────────────────────────────────────────

create table public.document_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  document_id uuid not null references public.user_documents(id) on delete cascade,

  -- One of a fixed list (see src/lib/document-facts/fields.ts). Text rather than
  -- an enum so adding a field is a code change, not a migration.
  field text not null,

  -- What the model read. Never edited after insert, so a correction can always
  -- be compared with what was on the page.
  extracted_value text not null,
  -- What the user confirmed. Equal to extracted_value unless they corrected it.
  confirmed_value text,

  -- The exact words on the document the value was read from, and the page.
  source_text text not null,
  page integer not null check (page > 0),

  status text not null default 'unconfirmed'
    check (status in ('unconfirmed', 'confirmed', 'rejected')),
  confirmed_at timestamptz,

  -- Model snapshot that produced the row, so a bad model version can be traced.
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One fact per field per document. This is also what keeps a rejected fact
  -- from being extracted again when the same document is re-read.
  unique (document_id, field),

  check (status <> 'confirmed' or (confirmed_value is not null and confirmed_at is not null))
);

create index document_facts_user_status_idx on public.document_facts(user_id, status, updated_at desc);

alter table public.document_facts enable row level security;

-- Inserts come only from the reader running with the service role, so there is
-- deliberately no insert policy for users.
create policy "document facts are self-readable"
on public.document_facts for select
using (user_id = auth.uid());

create policy "document facts are self-updatable"
on public.document_facts for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "document facts are self-deletable"
on public.document_facts for delete
using (user_id = auth.uid());

-- ── Daily page cap ────────────────────────────────────────────────────────────

create table public.document_reading_usage (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  day date not null,
  pages integer not null default 0 check (pages >= 0),
  primary key (user_id, day)
);

alter table public.document_reading_usage enable row level security;

create policy "document reading usage is self-readable"
on public.document_reading_usage for select
using (user_id = auth.uid());

-- Atomic add-and-check, so two documents finishing at once cannot both slip
-- under the cap. Returns true and records the pages when they fit.
create or replace function public.reserve_document_reading_pages(p_user_id uuid, p_pages integer, p_daily_cap integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_used integer;
begin
  insert into public.document_reading_usage (user_id, day, pages)
  values (p_user_id, v_day, 0)
  on conflict (user_id, day) do nothing;

  select pages into v_used
  from public.document_reading_usage
  where user_id = p_user_id and day = v_day
  for update;

  if v_used + p_pages > p_daily_cap then
    return false;
  end if;

  update public.document_reading_usage
  set pages = pages + p_pages
  where user_id = p_user_id and day = v_day;

  return true;
end;
$$;

revoke all on function public.reserve_document_reading_pages(uuid, integer, integer) from public, anon, authenticated;
