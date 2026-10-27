-- Wrong admin passcode guesses, used to lock out repeated guessing.
-- Only the server (service role) reads or writes this table.
create table if not exists public.admin_passcode_failures (
  id bigserial primary key,
  visitor_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_passcode_failures_created_at_idx
  on public.admin_passcode_failures (created_at);

create index if not exists admin_passcode_failures_visitor_idx
  on public.admin_passcode_failures (visitor_hash, created_at);

alter table public.admin_passcode_failures enable row level security;

revoke all on public.admin_passcode_failures from anon, authenticated;
