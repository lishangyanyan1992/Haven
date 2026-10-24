-- Advisor messages are written only by the server (openspec change advisor-firm-handoff).
--
-- 0002 let any signed-in user insert rows into their own advisor_messages. The
-- app never used it: persistExchange writes with the service role. But a stored
-- assistant answer is now trusted as evidence — "Let [firm] know" rebuilds a
-- contact request from the firm_contact_offer on that answer — so a user who
-- could insert their own "assistant" row could send their firm any text.
-- Reading their own messages is unchanged.

drop policy if exists "advisor messages are self-insertable" on public.advisor_messages;
