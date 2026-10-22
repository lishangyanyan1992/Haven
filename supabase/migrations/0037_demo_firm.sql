-- Demo firm flag (openspec change add-lawyer-demo-account).
--
-- Adds is_demo to public.firms to designate demo firms that are eligible
-- for simulated client data seeding and in-app resetting.

alter table public.firms
  add column is_demo boolean not null default false;
