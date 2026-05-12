create sequence if not exists public.community_author_label_seq
  start with 1000
  increment by 1;

create table if not exists public.community_authors (
  id uuid primary key default gen_random_uuid(),
  linked_user_id uuid references public.user_profiles(id) on delete set null,
  source text,
  external_author_key text,
  author_label text not null default ('Haven_User_' || lpad(nextval('public.community_author_label_seq')::text, 4, '0')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (linked_user_id is not null or external_author_key is not null)
);

create unique index if not exists community_authors_linked_user_id_key
  on public.community_authors(linked_user_id)
  where linked_user_id is not null;

create unique index if not exists community_authors_source_external_author_key_key
  on public.community_authors(source, external_author_key)
  where source is not null and external_author_key is not null;

drop trigger if exists community_authors_updated_at on public.community_authors;
create trigger community_authors_updated_at
before update on public.community_authors
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.community_posts
  add column if not exists author_id uuid references public.community_authors(id) on delete set null;

alter table public.community_post_comments
  add column if not exists author_id uuid references public.community_authors(id) on delete set null;

create index if not exists community_posts_author_id_idx
  on public.community_posts(author_id);

create index if not exists community_post_comments_author_id_idx
  on public.community_post_comments(author_id);

insert into public.community_authors (linked_user_id, author_label)
select distinct
  post.user_id,
  coalesce(profile.full_name, post.author_label)
from public.community_posts as post
left join public.user_profiles as profile on profile.id = post.user_id
where post.user_id is not null
on conflict do nothing;

insert into public.community_authors (linked_user_id, author_label)
select distinct
  comment.user_id,
  coalesce(profile.full_name, comment.author_label)
from public.community_post_comments as comment
left join public.user_profiles as profile on profile.id = comment.user_id
where comment.user_id is not null
on conflict do nothing;

insert into public.community_authors (source, external_author_key)
select distinct
  item.source,
  case
    when nullif(btrim(coalesce(item.source_payload_private->>'author_name', '')), '') is not null
      and lower(btrim(item.source_payload_private->>'author_name')) not in ('[deleted]', 'deleted', 'anonymous', 'unknown', 'reddit user', 'community member', 'member', 'user')
      then 'author:' || lower(btrim(item.source_payload_private->>'author_name'))
    else 'story:' || item.source_story_id || ':post'
  end
from public.community_posts as post
join public.community_import_items as item on item.id = post.import_item_id
where post.author_id is null
on conflict do nothing;

insert into public.community_authors (source, external_author_key)
select distinct
  item.source,
  case
    when nullif(btrim(coalesce(comment_source.value->>'author', '')), '') is not null
      and lower(btrim(comment_source.value->>'author')) not in ('[deleted]', 'deleted', 'anonymous', 'unknown', 'reddit user', 'community member', 'member', 'user')
      then 'author:' || lower(btrim(comment_source.value->>'author'))
    else 'story:' || item.source_story_id || ':comment:' || coalesce(comment_source.value->>'id', (comment.sort_order + 1)::text)
  end
from public.community_post_comments as comment
join public.community_import_items as item on item.id = comment.import_item_id
left join lateral (
  select src.value
  from jsonb_array_elements(coalesce(item.source_payload_private->'comments', '[]'::jsonb)) with ordinality as src(value, ord)
  where ord = comment.sort_order + 1
) as comment_source on true
where comment.author_id is null
on conflict do nothing;

update public.community_posts as post
set
  author_id = author.id,
  author_label = author.author_label
from public.community_authors as author
where post.user_id is not null
  and author.linked_user_id = post.user_id
  and (post.author_id is distinct from author.id or post.author_label is distinct from author.author_label);

update public.community_posts as post
set
  author_id = author.id,
  author_label = author.author_label
from public.community_import_items as item
join public.community_authors as author
  on author.source = item.source
 and author.external_author_key = case
   when nullif(btrim(coalesce(item.source_payload_private->>'author_name', '')), '') is not null
     and lower(btrim(item.source_payload_private->>'author_name')) not in ('[deleted]', 'deleted', 'anonymous', 'unknown', 'reddit user', 'community member', 'member', 'user')
     then 'author:' || lower(btrim(item.source_payload_private->>'author_name'))
   else 'story:' || item.source_story_id || ':post'
 end
where post.import_item_id = item.id
  and (post.author_id is distinct from author.id or post.author_label is distinct from author.author_label);

update public.community_post_comments as comment
set
  author_id = author.id,
  author_label = author.author_label
from public.community_authors as author
where comment.user_id is not null
  and author.linked_user_id = comment.user_id
  and (comment.author_id is distinct from author.id or comment.author_label is distinct from author.author_label);

with imported_comment_authors as (
  select
    comment.id as comment_id,
    author.id as author_id,
    author.author_label
  from public.community_post_comments as comment
  join public.community_import_items as item on item.id = comment.import_item_id
  left join lateral (
    select src.value
    from jsonb_array_elements(coalesce(item.source_payload_private->'comments', '[]'::jsonb)) with ordinality as src(value, ord)
    where ord = comment.sort_order + 1
  ) as comment_source on true
  join public.community_authors as author
    on author.source = item.source
   and author.external_author_key = case
     when nullif(btrim(coalesce(comment_source.value->>'author', '')), '') is not null
       and lower(btrim(comment_source.value->>'author')) not in ('[deleted]', 'deleted', 'anonymous', 'unknown', 'reddit user', 'community member', 'member', 'user')
       then 'author:' || lower(btrim(comment_source.value->>'author'))
     else 'story:' || item.source_story_id || ':comment:' || coalesce(comment_source.value->>'id', (comment.sort_order + 1)::text)
   end
)
update public.community_post_comments as comment
set
  author_id = imported_comment_authors.author_id,
  author_label = imported_comment_authors.author_label
from imported_comment_authors
where comment.id = imported_comment_authors.comment_id
  and (
    comment.author_id is distinct from imported_comment_authors.author_id
    or comment.author_label is distinct from imported_comment_authors.author_label
  );

alter table public.community_authors enable row level security;

create policy "community authors are readable"
on public.community_authors for select
using (true);
