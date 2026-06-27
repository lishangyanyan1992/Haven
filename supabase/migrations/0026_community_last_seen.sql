alter table public.user_profiles
  add column if not exists community_last_seen_at timestamptz;
