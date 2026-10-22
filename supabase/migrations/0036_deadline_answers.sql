-- Lead urgency ranking (openspec change add-lead-urgency-ranking).
--
-- deadline_answers: the client's own copy of their "Your deadlines" setup
-- answers. Written only by setup and the one-time deadline prompt; the chat
-- never writes it. The firm sees its own copy in firm_clients.shared_answers.
-- deadlines_prompted_at: set once the client has answered or skipped the
-- deadline questions, so the one-time prompt isn't shown again.
alter table public.user_profiles
  add column deadline_answers jsonb not null default '{}'::jsonb,
  add column deadlines_prompted_at timestamptz;
