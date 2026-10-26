-- Firm consultation booking channels.
--
-- Adds consultation_booking_url (e.g. Calendly, Cal.com) and consultation_email
-- to public.firms so law firms can configure direct scheduling channels for clients.

alter table public.firms
  add column if not exists consultation_booking_url text,
  add column if not exists consultation_email text;

alter table public.firms
  add constraint firms_consultation_booking_url_format
  check (consultation_booking_url is null or consultation_booking_url ~* '^https?://') not valid;

alter table public.firms
  add constraint firms_consultation_email_format
  check (consultation_email is null or consultation_email ~* '^.+@.+\..+$') not valid;
