alter table public.community_posts
  add column if not exists import_item_id uuid references public.community_import_items(id) on delete set null;

update public.community_posts as post
set import_item_id = item.id
from public.community_import_items as item
where item.published_post_id = post.id
  and post.import_item_id is null;

create unique index if not exists community_posts_import_item_id_key
  on public.community_posts(import_item_id)
  where import_item_id is not null;
