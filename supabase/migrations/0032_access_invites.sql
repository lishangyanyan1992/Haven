-- Haven is invitation only (Oct 2026). Only emails on this list can use the
-- product. Lawyers will add their clients here later.
--
-- Deployment requirement: turn OFF "Allow new users to sign up" in Supabase
-- Auth settings. New accounts are created only by the invite email Haven
-- sends to the invited address, which proves the person owns that mailbox.
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

-- True when the signed-in person is on the invite list and has confirmed
-- their email. Runs with owner rights so the list stays unreadable to users.
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
  );
$$;

revoke all on function public.haven_has_access() from public;
grant execute on function public.haven_has_access() to authenticated;

-- Close the direct-database back door. These restrictive policies are ANDed
-- with every existing "own rows" policy, so an account without an invite
-- can no longer read or change its own data with its login. The server's
-- admin client bypasses row security and is unaffected.
-- wizard_sessions is left out on purpose: the separate ImmigWizard app uses
-- it with the same logins and is not part of the Haven invite.
do $$
declare
  t text;
begin
  foreach t in array array[
    'advisor_feedback', 'advisor_message_citations', 'advisor_messages',
    'advisor_remembered_facts', 'advisor_threads', 'community_memberships',
    'derived_signals', 'document_chunks', 'document_facts',
    'document_reading_usage', 'email_aliases', 'email_contacts',
    'email_ingest_records', 'email_notification_deliveries', 'email_threads',
    'layoff_checklist_completions', 'layoff_events', 'timeline_events',
    'user_documents', 'user_profiles'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "invited accounts only" on public.%I', t);
      execute format(
        'create policy "invited accounts only" on public.%I as restrictive for all to authenticated '
        'using (public.haven_has_access()) with check (public.haven_has_access())',
        t
      );
    end if;
  end loop;
end
$$;

drop policy if exists "vault needs an invite" on storage.objects;
create policy "vault needs an invite"
on storage.objects
as restrictive
for all
to authenticated
using (bucket_id <> 'haven-vault' or public.haven_has_access())
with check (bucket_id <> 'haven-vault' or public.haven_has_access());
