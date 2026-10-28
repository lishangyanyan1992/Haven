-- Allow clients to connect to multiple law firms while enforcing at most one
-- record per client per firm.

alter table public.firm_clients
  drop constraint if exists firm_clients_normalized_email_key,
  drop constraint if exists firm_clients_user_id_key;

-- Composite unique constraint: (firm_id, normalized_email)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'firm_clients_firm_email_key'
      and conrelid = 'public.firm_clients'::regclass
  ) then
    alter table public.firm_clients
      add constraint firm_clients_firm_email_key
      unique (firm_id, normalized_email);
  end if;
end $$;

-- Composite partial unique index: at most one row per (firm_id, user_id) when user_id is set
create unique index if not exists firm_clients_firm_user_uidx
  on public.firm_clients (firm_id, user_id)
  where user_id is not null;

-- Helpful index for looking up all firm engagements for a given user
create index if not exists firm_clients_user_id_idx
  on public.firm_clients (user_id)
  where user_id is not null;
