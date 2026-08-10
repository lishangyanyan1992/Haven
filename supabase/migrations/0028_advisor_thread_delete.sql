-- Advisor conversation history: let a user delete their own conversations.
--
-- 0002_advisor.sql created advisor_threads and advisor_messages with select and
-- insert policies, but no delete policy — because nothing was ever written to
-- those tables, so nothing ever needed removing. Conversations are persisted now,
-- and a product that stores months of somebody's immigration questions has to let
-- them take that back.
--
-- Deleting the thread is enough: advisor_messages, advisor_message_citations and
-- advisor_feedback all reference it with `on delete cascade`, and cascaded deletes
-- are performed by the system rather than the caller, so they are not themselves
-- subject to row-level security. One policy removes the whole conversation.

create policy "advisor threads are self-deletable"
on public.advisor_threads for delete
using (user_id = auth.uid());

-- Messages carry their own delete policy too. Not needed for the cascade above,
-- but without it a future "delete just this message" path would fail closed in a
-- way that looks like a bug rather than a missing policy.
create policy "advisor messages are self-deletable"
on public.advisor_messages for delete
using (user_id = auth.uid());

-- The conversation list is ordered by most recent activity, so it reads
-- advisor_threads by user and updated_at. 0002 already created exactly that index
-- (advisor_threads_user_id_idx on (user_id, updated_at desc)); no new index needed.
