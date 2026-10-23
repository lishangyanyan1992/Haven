-- Firm client engagement tracking.
--
-- Stores lawyer-managed engagement milestones (initial consultation call,
-- contract signed, case preparation, petition filed, scheduled dates, and
-- client-facing notes) on public.firm_clients.
-- Also persists i140_filed stage flag on public.user_profiles.

alter table public.firm_clients
  add column if not exists engagement_state jsonb not null default '{}'::jsonb;

alter table public.firm_clients
  add constraint firm_clients_engagement_state_is_object
  check (jsonb_typeof(engagement_state) = 'object');

alter table public.user_profiles
  add column if not exists i140_filed boolean not null default false;

