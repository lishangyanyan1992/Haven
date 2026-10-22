-- Firm intake hardening (review of add-firm-dashboard).
--
-- 1. claim_token_hash: joining a firm needs the one-time code from the email
--    Haven sent for that intake, not just a sign-in with the same address.
-- 2. shared_answers: the setup answers the firm can see. Written only when
--    the client saves setup or settings, never by the chat, so nothing said
--    in a chat reaches the lawyer.
-- 3. firm_intake_reserve_send: checks the send limits and records the send
--    in one locked step, so parallel requests can't slip past the limits.
-- 4. firm_replace_intake_link: revokes and replaces a link in one
--    transaction, so a failed replacement keeps the old link working.

alter table public.firm_clients
  add column claim_token_hash text,
  add column shared_answers jsonb not null default '{}'::jsonb;

create or replace function public.firm_intake_reserve_send(
  p_link_id uuid,
  p_email text,
  p_ip_hash text,
  p_email_per_hour int,
  p_visitor_per_hour int,
  p_link_per_day int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email int;
  v_visitor int;
  v_link int;
begin
  -- One lock per link serialises its sends; email and visitor limits are
  -- per link anyway in practice, and global sends are capped by Supabase.
  perform pg_advisory_xact_lock(hashtextextended(p_link_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('email:' || p_email, 0));
  perform pg_advisory_xact_lock(hashtextextended('ip:' || p_ip_hash, 0));

  select count(*) into v_email from public.firm_intake_sends
    where normalized_email = p_email and created_at > now() - interval '1 hour';
  select count(*) into v_visitor from public.firm_intake_sends
    where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
  select count(*) into v_link from public.firm_intake_sends
    where link_id = p_link_id and created_at > now() - interval '1 day';

  if v_email >= p_email_per_hour or v_visitor >= p_visitor_per_hour or v_link >= p_link_per_day then
    return false;
  end if;

  insert into public.firm_intake_sends (link_id, normalized_email, ip_hash)
  values (p_link_id, p_email, p_ip_hash);
  return true;
end;
$$;

create or replace function public.firm_replace_intake_link(p_firm_id uuid, p_token text)
returns public.firm_intake_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.firm_intake_links;
begin
  update public.firm_intake_links
    set revoked_at = now(), is_active = false
    where firm_id = p_firm_id and revoked_at is null;

  insert into public.firm_intake_links (firm_id, token, is_active)
  values (p_firm_id, p_token, true)
  returning * into v_link;

  return v_link;
end;
$$;

-- Only the server (service role) may call these.
revoke all on function public.firm_intake_reserve_send(uuid, text, text, int, int, int) from public, anon, authenticated;
revoke all on function public.firm_replace_intake_link(uuid, text) from public, anon, authenticated;
grant execute on function public.firm_intake_reserve_send(uuid, text, text, int, int, int) to service_role;
grant execute on function public.firm_replace_intake_link(uuid, text) to service_role;
