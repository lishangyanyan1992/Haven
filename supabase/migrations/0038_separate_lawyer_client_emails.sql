-- 0038_separate_lawyer_client_emails.sql
-- Enforces strict separation between law firm lawyer accounts / pilot inquiries
-- and client accounts across the database.

-- 1. Dedicated lawyer pilot requests table
create table if not exists public.firm_pilot_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  firm_name text not null,
  email text not null,
  normalized_email text not null unique,
  note text,
  source_path text not null default '/register',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists firm_pilot_requests_created_at_idx
  on public.firm_pilot_requests (created_at desc);

alter table public.firm_pilot_requests enable row level security;

-- Migrate any lawyer signups out of waitlist_signups into firm_pilot_requests
do $$
begin
  if exists (
    select 1
    from public.waitlist_signups ws
    where ws.interest_key = 'lawyer_access'
      and (
        exists (
          select 1
          from public.waitlist_signups o
          where o.normalized_email = ws.normalized_email
            and o.interest_key <> 'lawyer_access'
        )
        or exists (
          select 1
          from public.access_invites i
          where i.normalized_email = ws.normalized_email
        )
        or exists (
          select 1
          from public.firm_clients c
          where c.normalized_email = ws.normalized_email
        )
        or exists (
          select 1
          from public.user_profiles p
          where lower(p.email) = ws.normalized_email
        )
      )
  )
  or exists (
    select 1
    from public.firm_members fm
    where exists (
            select 1
            from public.access_invites i
            where i.normalized_email = lower(trim(fm.email))
          )
       or exists (
            select 1
            from public.firm_clients c
            where c.normalized_email = lower(trim(fm.email))
          )
       or exists (
            select 1
            from public.user_profiles p
            where lower(p.email) = lower(trim(fm.email))
          )
       or exists (
            select 1
            from public.waitlist_signups ws
            where ws.normalized_email = lower(trim(fm.email))
          )
       or exists (
            select 1
            from public.firm_clients c
            where c.user_id = fm.user_id
          )
       or exists (
            select 1
            from public.user_profiles p
            where p.id = fm.user_id
          )
  ) then
    raise exception 'Lawyer/client email or user overlap exists. Resolve it before applying 0038.';
  end if;
end $$;

insert into public.firm_pilot_requests (full_name, firm_name, email, normalized_email, note, source_path, created_at, updated_at)
select
  ws.full_name,
  coalesce(ws.metadata->>'firm', 'Law Firm') as firm_name,
  ws.email,
  ws.normalized_email,
  ws.metadata->>'note' as note,
  ws.source_path,
  ws.created_at,
  ws.updated_at
from public.waitlist_signups ws
where ws.interest_key = 'lawyer_access'
on conflict (normalized_email) do nothing;

delete from public.waitlist_signups
where interest_key = 'lawyer_access';

-- 2. Clean and constrain firm_members email
update public.firm_members
set email = lower(trim(email))
where email <> lower(trim(email));

alter table public.firm_members
  drop constraint if exists firm_members_email_lower_chk;

alter table public.firm_members
  add constraint firm_members_email_lower_chk check (email = lower(trim(email)));

create unique index if not exists firm_members_email_uidx
  on public.firm_members (email);

-- 3. Trigger to prevent adding lawyer emails or users that exist as clients
create or replace function public.assert_not_client_email_or_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_user_id uuid;
begin
  if tg_table_name = 'firm_members' then
    v_email := lower(trim(new.email));
    v_user_id := new.user_id;
  elsif tg_table_name = 'firm_pilot_requests' then
    v_email := lower(trim(new.normalized_email));
    v_user_id := null;
  else
    v_email := lower(trim(coalesce(new.email, '')));
    v_user_id := null;
  end if;

  if exists (select 1 from public.access_invites where normalized_email = v_email) then
    raise exception 'Role conflict: email % already exists as a client in access_invites', v_email;
  end if;

  if exists (select 1 from public.firm_clients where normalized_email = v_email) then
    raise exception 'Role conflict: email % already exists as a client in firm_clients', v_email;
  end if;

  if exists (select 1 from public.user_profiles where lower(email) = v_email) then
    raise exception 'Role conflict: email % already has a client user profile', v_email;
  end if;

  if exists (select 1 from public.waitlist_signups where normalized_email = v_email) then
    raise exception 'Role conflict: email % already exists on the client waitlist', v_email;
  end if;

  if v_user_id is not null then
    if exists (select 1 from public.firm_clients where user_id = v_user_id) then
      raise exception 'Role conflict: user_id % is already associated with a client in firm_clients', v_user_id;
    end if;
    if exists (select 1 from public.user_profiles where id = v_user_id) then
      raise exception 'Role conflict: user_id % already has a client user profile', v_user_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists check_firm_members_not_client on public.firm_members;
create trigger check_firm_members_not_client
before insert or update on public.firm_members
for each row
execute function public.assert_not_client_email_or_user();

drop trigger if exists check_firm_pilot_not_client on public.firm_pilot_requests;
create trigger check_firm_pilot_not_client
before insert or update on public.firm_pilot_requests
for each row
execute function public.assert_not_client_email_or_user();

-- 4. Trigger to prevent adding client emails or users that exist as lawyers
create or replace function public.assert_not_lawyer_email_or_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_user_id uuid;
begin
  if tg_table_name = 'access_invites' then
    v_email := lower(trim(new.normalized_email));
    v_user_id := null;
  elsif tg_table_name = 'firm_clients' then
    v_email := lower(trim(new.normalized_email));
    v_user_id := new.user_id;
  elsif tg_table_name = 'user_profiles' then
    v_email := lower(trim(new.email));
    v_user_id := new.id;
  elsif tg_table_name = 'waitlist_signups' then
    v_email := lower(trim(new.normalized_email));
    v_user_id := null;
  else
    v_email := null;
    v_user_id := null;
  end if;

  if v_email is not null and length(v_email) > 0 then
    if exists (select 1 from public.firm_members where email = v_email) then
      raise exception 'Role conflict: email % is already registered as a firm lawyer', v_email;
    end if;

    if exists (select 1 from public.firm_pilot_requests where normalized_email = v_email) then
      raise exception 'Role conflict: email % has an active law firm pilot request', v_email;
    end if;
  end if;

  if v_user_id is not null then
    if exists (select 1 from public.firm_members where user_id = v_user_id) then
      raise exception 'Role conflict: user_id % is already registered as a firm lawyer', v_user_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists check_access_invites_not_lawyer on public.access_invites;
create trigger check_access_invites_not_lawyer
before insert or update on public.access_invites
for each row
execute function public.assert_not_lawyer_email_or_user();

drop trigger if exists check_firm_clients_not_lawyer on public.firm_clients;
create trigger check_firm_clients_not_lawyer
before insert or update on public.firm_clients
for each row
execute function public.assert_not_lawyer_email_or_user();

drop trigger if exists check_user_profiles_not_lawyer on public.user_profiles;
create trigger check_user_profiles_not_lawyer
before insert or update on public.user_profiles
for each row
execute function public.assert_not_lawyer_email_or_user();

drop trigger if exists check_waitlist_signups_not_lawyer on public.waitlist_signups;
create trigger check_waitlist_signups_not_lawyer
before insert or update on public.waitlist_signups
for each row
execute function public.assert_not_lawyer_email_or_user();

-- 5. Harden haven_has_access to strictly deny any lawyer member
create or replace function public.haven_has_access()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    join public.access_invites i on i.normalized_email = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and not exists (
        select 1
        from public.firm_members fm
        where fm.user_id = u.id
           or fm.email = lower(u.email)
      )
  );
$$;

revoke all on function public.haven_has_access() from public;
grant execute on function public.haven_has_access() to authenticated;
