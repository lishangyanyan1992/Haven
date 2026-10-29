-- Client and lawyer messaging (openspec change client-lawyer-messaging).
--
-- 1. "What help do you need from your lawyer?" replaces "Main concerns" in
--    setup. The answer lives in user_profiles.help_needed; top_concerns is
--    still written (derived from it in code) for community matching.
-- 2. Firms that had "Main concerns" in their setup questions get the new
--    question in the same place.
-- 3. One conversation per client per firm, and its messages.
-- 4. A record of when a client was told a firm can see their AI chats. A firm
--    sees only chats started after that moment.
--
-- All writes go through server actions with the service role, which derive
-- the firm and client from the signed-in user. The policies below only allow
-- reads. Firms get no policy on the advisor tables: the server checks every
-- firm read of an AI chat against the acknowledgement time.

-- 1. Help choices -------------------------------------------------------------

alter table public.user_profiles
  add column if not exists help_needed text[] not null default '{}';

alter table public.user_profiles
  add constraint user_profiles_help_needed_values check (
    help_needed <@ array[
      'first_consultation',
      'case_review',
      'job_loss_plan',
      'changing_employers',
      'other_paths',
      'green_card_next_step',
      'extend_status',
      'family',
      'something_else'
    ]::text[]
  );

-- 2. Rename the setup question key in each firm's list, keeping its position.

update public.firms f
set intake_questions = (
  select jsonb_agg(
    case
      when elem->>'key' = 'topConcerns'
        then jsonb_build_object('key', 'helpNeeded', 'label', 'Help needed from your lawyer', 'isCustom', false)
      else elem
    end
    order by ord
  )
  from jsonb_array_elements(f.intake_questions) with ordinality as t(elem, ord)
)
where f.intake_questions is not null
  and f.intake_questions @> '[{"key": "topConcerns"}]'::jsonb;

-- 3. Conversations and messages ----------------------------------------------

create table public.firm_conversations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  firm_client_id uuid not null references public.firm_clients(id) on delete cascade,
  client_last_read_at timestamptz,
  firm_last_read_at timestamptz,
  client_last_alerted_at timestamptz,
  firm_last_alerted_at timestamptz,
  last_message_at timestamptz,
  last_client_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (firm_id, firm_client_id)
);

create index firm_conversations_firm_idx
  on public.firm_conversations(firm_id, last_message_at desc);

create table public.firm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.firm_conversations(id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'lawyer')),
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_name text not null default '' check (length(sender_name) <= 200),
  body text not null check (length(btrim(body)) between 1 and 5000),
  source text not null default 'dashboard' check (source in ('onboarding', 'dashboard', 'advisor_reply')),
  advisor_message_id uuid references public.advisor_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create index firm_messages_conversation_idx
  on public.firm_messages(conversation_id, created_at);

-- The setup message is sent once per firm, however many times setup is saved.
create unique index firm_messages_one_onboarding_idx
  on public.firm_messages(conversation_id)
  where source = 'onboarding';

-- 4. AI chat visibility acknowledgements --------------------------------------

create table public.advisor_firm_visibility_acks (
  user_id uuid not null references auth.users(id) on delete cascade,
  firm_id uuid not null references public.firms(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (user_id, firm_id)
);

-- Read-only policies ----------------------------------------------------------

alter table public.firm_conversations enable row level security;
alter table public.firm_messages enable row level security;
alter table public.advisor_firm_visibility_acks enable row level security;

create policy "lawyers read their firm's conversations"
on public.firm_conversations for select to authenticated
using (firm_id = public.haven_firm_id());

create policy "clients read their own conversations"
on public.firm_conversations for select to authenticated
using (
  exists (
    select 1 from public.firm_clients fc
    where fc.id = firm_client_id and fc.user_id = auth.uid()
  )
);

create policy "lawyers read their firm's messages"
on public.firm_messages for select to authenticated
using (
  exists (
    select 1 from public.firm_conversations c
    where c.id = conversation_id and c.firm_id = public.haven_firm_id()
  )
);

create policy "clients read their own messages"
on public.firm_messages for select to authenticated
using (
  exists (
    select 1
    from public.firm_conversations c
    join public.firm_clients fc on fc.id = c.firm_client_id
    where c.id = conversation_id and fc.user_id = auth.uid()
  )
);

create policy "clients read their own visibility acknowledgements"
on public.advisor_firm_visibility_acks for select to authenticated
using (user_id = auth.uid());
