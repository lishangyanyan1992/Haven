-- Firm contact requests (openspec change advisor-firm-handoff).
--
-- A firm's client asks, from the advisor's lawyer handoff, to be contacted by
-- the firm that invited them. The row holds only what the handoff showed them:
-- the practice area, their own dates, and the suggested questions. It never
-- references an advisor thread or message, so nothing here leads a lawyer back
-- to the conversation.
--
-- Rows are written only by server actions with the service role: the client
-- action derives the firm from firm_clients, never from input, and the handled
-- action is scoped to the lawyer's firm. So the only policy is a lawyer read.

create table public.firm_contact_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  firm_client_id uuid not null references public.firm_clients(id) on delete cascade,
  practice_area text not null check (length(trim(practice_area)) between 1 and 120),
  dates jsonb not null default '[]'::jsonb check (jsonb_typeof(dates) = 'array'),
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);

-- One open request per client. A repeat click while one is open hits this and
-- the action answers "already sent" with the existing row's time.
create unique index firm_contact_requests_one_open_idx
  on public.firm_contact_requests(firm_client_id)
  where handled_at is null;

create index firm_contact_requests_dashboard_idx
  on public.firm_contact_requests(firm_id, handled_at, created_at desc);

alter table public.firm_contact_requests enable row level security;

create policy "lawyers read their firm's contact requests"
on public.firm_contact_requests for select to authenticated
using (firm_id = public.haven_firm_id());
