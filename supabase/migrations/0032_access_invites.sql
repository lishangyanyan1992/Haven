-- Haven is invitation only (Oct 2026). Only emails on this list, plus the
-- owner, can use the product. Lawyers will add their clients here later.
create table if not exists public.access_invites (
  normalized_email text primary key,
  invited_by text not null default 'owner',
  note text,
  created_at timestamptz not null default now()
);

alter table public.access_invites enable row level security;

insert into public.access_invites (normalized_email, invited_by, note)
values ('lshangyanyan@gmail.com', 'owner', 'Owner')
on conflict (normalized_email) do nothing;

-- True when the signed-in person is on the invite list. Runs with owner rights
-- so the list itself stays unreadable to users.
create or replace function public.haven_has_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.access_invites
    where normalized_email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.haven_has_access() from public;
grant execute on function public.haven_has_access() to authenticated;
