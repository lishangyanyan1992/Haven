alter table public.user_profiles
  add column community_reply_email_notifications boolean not null default false,
  add column status_update_email_notifications boolean not null default false;

create table public.email_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  notification_kind text not null check (notification_kind in ('community_reply', 'status_update')),
  dedupe_key text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, notification_kind, dedupe_key)
);

create index email_notification_deliveries_user_id_idx
  on public.email_notification_deliveries (user_id, created_at desc);

alter table public.email_notification_deliveries enable row level security;

create policy "email notification deliveries are self-readable"
on public.email_notification_deliveries for select
using (auth.uid() = user_id);
