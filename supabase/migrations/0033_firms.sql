-- Firm dashboard (openspec change add-firm-dashboard).
--
-- Law firms, their lawyer logins, one shareable intake link per firm, and the
-- clients who joined through it. All writes go through the server's admin
-- client. Lawyers can read only their own firm's rows with their login.
-- Clients and signed-out visitors can read none of these tables.

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  created_at timestamptz not null default now()
);

-- One firm per lawyer: user_id is unique across all firms.
create table public.firm_members (
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);

create table public.firm_intake_links (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  token text not null unique check (length(token) >= 32),
  is_active boolean not null default true,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- At most one link per firm that hasn't been replaced.
create unique index firm_intake_links_one_current
  on public.firm_intake_links(firm_id)
  where revoked_at is null;

-- One firm per client: the first firm to reach an email owns it.
create table public.firm_clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  normalized_email text not null unique,
  user_id uuid unique references auth.users(id) on delete set null,
  link_id uuid references public.firm_intake_links(id) on delete set null,
  email_sent_at timestamptz not null default now(),
  consented_at timestamptz not null default now(),
  joined_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index firm_clients_firm_idx on public.firm_clients(firm_id, created_at desc);

-- Every sign-up email a link sends, for rate limits. The visitor is a salted
-- hash, never a raw IP.
create table public.firm_intake_sends (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.firm_intake_links(id) on delete cascade,
  normalized_email text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index firm_intake_sends_link_idx on public.firm_intake_sends(link_id, created_at desc);
create index firm_intake_sends_email_idx on public.firm_intake_sends(normalized_email, created_at desc);
create index firm_intake_sends_ip_idx on public.firm_intake_sends(ip_hash, created_at desc);

-- The signed-in lawyer's firm, or null for anyone who isn't a lawyer.
create or replace function public.haven_firm_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select firm_id from public.firm_members where user_id = auth.uid();
$$;

revoke all on function public.haven_firm_id() from public;
grant execute on function public.haven_firm_id() to authenticated;

alter table public.firms enable row level security;
alter table public.firm_members enable row level security;
alter table public.firm_intake_links enable row level security;
alter table public.firm_clients enable row level security;
alter table public.firm_intake_sends enable row level security;

create policy "lawyers read their own firm"
on public.firms for select to authenticated
using (id = public.haven_firm_id());

create policy "lawyers read their firm's members"
on public.firm_members for select to authenticated
using (firm_id = public.haven_firm_id());

create policy "lawyers read their firm's links"
on public.firm_intake_links for select to authenticated
using (firm_id = public.haven_firm_id());

create policy "lawyers read their firm's clients"
on public.firm_clients for select to authenticated
using (firm_id = public.haven_firm_id());

-- firm_intake_sends has no policies: only the server reads or writes it.
