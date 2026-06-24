-- 0019_aggregate_case_outcomes.sql
-- The AI's query path into community_case_data_points. Purely additive: one new function.
-- Keystone: callers never select raw rows — they call this security-definer function, which returns
-- ONLY aggregates and enforces k-anonymity (cells below p_min_cell are lumped into 'other', shown only
-- if that combined bucket itself clears the floor). "Queryable by AI" and "can't leak an individual"
-- are the same mechanism.

create or replace function public.aggregate_case_outcomes(
  p_current_status text default null,
  p_i140_status text default null,
  p_nationality_bucket text default null,
  p_category text default null,
  p_trigger text default null,
  p_min_cell integer default 5,         -- k-anonymity floor
  p_recency_months integer default 24   -- recency window (stale-pattern guard)
)
returns table (
  total_n integer,                      -- segment size BEFORE rollup → drives the disclosure tier
  path_taken text,
  n integer,
  pct numeric,
  resolved_n integer,                   -- approved+denied on this path (gates outcome display)
  approved_pct numeric,                 -- of resolved; null for the 'other' bucket
  rfe_pct numeric,
  median_days_to_file numeric,
  median_days_to_decision numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select *
    from public.community_case_data_points
    where moderation_status = 'approved'
      and source in ('first_party','consented')                       -- scraped/prototype never counted
      and (case_date is null or case_date >= current_date - make_interval(months => p_recency_months))
      and (p_current_status     is null or current_status     = p_current_status)
      and (p_i140_status        is null or i140_status         = p_i140_status)
      and (p_nationality_bucket is null or nationality_bucket  = p_nationality_bucket)
      and (p_category           is null or category            = p_category)
      and (p_trigger            is null or trigger             = p_trigger)
  ),
  counts as (select path_taken, count(*) as c from filtered group by path_taken),
  keep   as (select path_taken from counts where c >= p_min_cell),
  labeled as (
    select f.*,
           case when f.path_taken in (select path_taken from keep) then f.path_taken else 'other' end as bucket
    from filtered f
  ),
  total as (select count(*)::int as total_n from filtered)
  select
    (select total_n from total)                                                   as total_n,
    l.bucket                                                                       as path_taken,
    count(*)::int                                                                  as n,
    round(100.0 * count(*) / nullif((select total_n from total), 0), 0)           as pct,
    case when l.bucket = 'other' then null
         else count(*) filter (where l.outcome in ('approved','denied'))::int end as resolved_n,
    case when l.bucket = 'other' then null
         else round(100.0 * count(*) filter (where l.outcome = 'approved')
              / nullif(count(*) filter (where l.outcome in ('approved','denied')), 0), 0) end as approved_pct,
    case when l.bucket = 'other' then null
         else round(100.0 * count(*) filter (where l.got_rfe) / nullif(count(*), 0), 0) end   as rfe_pct,
    case when l.bucket = 'other' then null
         else percentile_cont(0.5) within group (order by l.time_to_file_days) end            as median_days_to_file,
    case when l.bucket = 'other' then null
         else percentile_cont(0.5) within group (order by l.time_to_decision_days) end        as median_days_to_decision
  from labeled l
  group by l.bucket
  having count(*) >= p_min_cell          -- 'other' shown only if the lumped bucket also clears the floor
  order by (l.bucket = 'other'), n desc; -- push 'other' last
$$;

-- Tighten access: only the server (service role) calls this; revoke the default public execute.
revoke all on function public.aggregate_case_outcomes(text,text,text,text,text,integer,integer) from public;
grant execute on function public.aggregate_case_outcomes(text,text,text,text,text,integer,integer) to service_role;
