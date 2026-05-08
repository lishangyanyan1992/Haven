create table if not exists public.community_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  import_item_id uuid references public.community_import_items(id) on delete set null,
  user_id uuid references public.user_profiles(id) on delete set null,
  author_label text not null,
  body text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists community_post_comments_post_id_idx
  on public.community_post_comments(post_id, sort_order, created_at);

create index if not exists community_post_comments_import_item_id_idx
  on public.community_post_comments(import_item_id);

alter table public.community_post_comments enable row level security;

create policy "community post comments are readable"
on public.community_post_comments for select
using (true);
