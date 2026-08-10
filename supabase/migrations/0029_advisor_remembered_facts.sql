-- Advisor long-term memory: facts the user told us, carried across conversations.
--
-- Release one made conversations survive a reload. This is the half that makes
-- the Advisor act on them: somebody who says "my last day was March 3rd" should
-- not have to say it again next week.
--
-- The important design decision is in the `quote` column. We store the user's own
-- sentence verbatim and never a parsed value. Parsing "March 3rd" into a date and
-- storing 2026-03-03 would mean a misparse becomes a wrong deadline in a product
-- where the deadline is the whole question — and it would be wrong silently,
-- forever, in every future conversation. Storing the sentence keeps interpretation
-- where it already happens (at answer time, with the guardrails applied) and keeps
-- the user's words auditable against what the Advisor did with them.
--
-- Every row is therefore evidence, not a conclusion.

create table public.advisor_remembered_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,

  -- Where it came from. Both nullable on delete so that deleting a conversation
  -- does not silently delete the memory formed from it -- the user asked to remove
  -- a conversation, which is not the same as asking to be forgotten. They can
  -- remove the fact itself separately, and the UI lists them precisely so that
  -- choice is visible rather than implied.
  thread_id uuid references public.advisor_threads(id) on delete set null,
  source_message_id uuid references public.advisor_messages(id) on delete set null,

  -- Coarse grouping, used for display and for capping how many of each kind are
  -- carried into a prompt. Deliberately text rather than an enum: the useful
  -- categories will change as we learn what people actually restate, and an enum
  -- migration for that is friction with no payoff.
  kind text not null,

  -- The user's own words. Never a parsed or normalised value.
  quote text not null,

  -- Hash of the quote, as a stored generated column rather than an expression
  -- index, because PostgREST's on-conflict target must name real columns. This is
  -- what makes "the user restated the same fact" an idempotent no-op instead of a
  -- duplicate row or a write error.
  quote_hash text not null generated always as (md5(quote)) stored,

  -- Set when the user removes it. Kept rather than hard-deleted so the extractor
  -- can avoid re-learning something that was just dismissed; purged by the same
  -- cascade when the account goes.
  dismissed_at timestamptz,

  created_at timestamptz not null default now()
);

-- One row per identical sentence per user. Re-stating the same fact in a later
-- conversation should not accumulate duplicates.
create unique index advisor_remembered_facts_unique_quote_idx
  on public.advisor_remembered_facts (user_id, quote_hash);

-- The read path: a user's live facts, newest first.
create index advisor_remembered_facts_user_idx
  on public.advisor_remembered_facts (user_id, created_at desc);

alter table public.advisor_remembered_facts enable row level security;

create policy "remembered facts are self-readable"
on public.advisor_remembered_facts for select
using (user_id = auth.uid());

create policy "remembered facts are self-insertable"
on public.advisor_remembered_facts for insert
with check (user_id = auth.uid());

create policy "remembered facts are self-updatable"
on public.advisor_remembered_facts for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "remembered facts are self-deletable"
on public.advisor_remembered_facts for delete
using (user_id = auth.uid());
