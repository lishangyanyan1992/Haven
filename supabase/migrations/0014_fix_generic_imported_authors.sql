insert into public.community_authors (source, external_author_key)
select distinct
  item.source,
  'story:' || item.source_story_id || ':post'
from public.community_posts as post
join public.community_import_items as item on item.id = post.import_item_id
where coalesce(lower(btrim(item.source_payload_private->>'author_name')), '') in ('', '[deleted]', 'deleted', 'anonymous', 'unknown', 'reddit user', 'community member', 'member', 'user')
on conflict do nothing;

insert into public.community_authors (source, external_author_key)
select distinct
  item.source,
  'story:' || item.source_story_id || ':comment:' || coalesce(comment_source.value->>'id', (comment.sort_order + 1)::text)
from public.community_post_comments as comment
join public.community_import_items as item on item.id = comment.import_item_id
left join lateral (
  select src.value
  from jsonb_array_elements(coalesce(item.source_payload_private->'comments', '[]'::jsonb)) with ordinality as src(value, ord)
  where ord = comment.sort_order + 1
) as comment_source on true
where coalesce(lower(btrim(comment_source.value->>'author')), '') in ('', '[deleted]', 'deleted', 'anonymous', 'unknown', 'reddit user', 'community member', 'member', 'user')
on conflict do nothing;

update public.community_posts as post
set
  author_id = author.id,
  author_label = author.author_label
from public.community_import_items as item
join public.community_authors as author
  on author.source = item.source
 and author.external_author_key = 'story:' || item.source_story_id || ':post'
where post.import_item_id = item.id
  and coalesce(lower(btrim(item.source_payload_private->>'author_name')), '') in ('', '[deleted]', 'deleted', 'anonymous', 'unknown', 'reddit user', 'community member', 'member', 'user')
  and (post.author_id is distinct from author.id or post.author_label is distinct from author.author_label);

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
   and author.external_author_key = 'story:' || item.source_story_id || ':comment:' || coalesce(comment_source.value->>'id', (comment.sort_order + 1)::text)
  where coalesce(lower(btrim(comment_source.value->>'author')), '') in ('', '[deleted]', 'deleted', 'anonymous', 'unknown', 'reddit user', 'community member', 'member', 'user')
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

delete from public.community_authors as author
where author.linked_user_id is null
  and author.external_author_key in (
    'author:[deleted]',
    'author:deleted',
    'author:anonymous',
    'author:unknown',
    'author:reddit user',
    'author:community member',
    'author:member',
    'author:user'
  )
  and not exists (
    select 1
    from public.community_posts as post
    where post.author_id = author.id
  )
  and not exists (
    select 1
    from public.community_post_comments as comment
    where comment.author_id = author.id
  );
