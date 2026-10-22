-- Keep the previous intake email's code usable alongside the newest one.
-- Each send saves its code before the email goes out (moving the old code
-- here), so neither a failed send nor a failed save leaves a delivered
-- link that can't join.
alter table public.firm_clients
  add column previous_claim_token_hash text;
