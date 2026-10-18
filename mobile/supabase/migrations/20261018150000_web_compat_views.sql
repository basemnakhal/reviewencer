-- ============================================================
-- Views + RPC the web app reads, rebuilt on the new businesses schema.
-- (The originals pointed at the pre-May tables and no longer exist.)
-- Both views are security_invoker so RLS on the base tables applies.
-- ============================================================

create view public.business_cards with (security_invoker = true) as
select
  b.id,
  b.slug,
  b.name_en                               as name,
  b.tagline,
  b.logo_url,
  b.verified,
  c.slug                                  as category_id,
  c.name_en                               as category_label,
  coalesce(s.headline, '')                as ai_headline,
  coalesce(s.sentiment, 0)                as sentiment,
  coalesce(s.review_count, 0)             as review_count,
  coalesce(s.avg_rating, 0::numeric)      as avg_rating,
  coalesce(s.themes, '[]'::jsonb)         as themes
from public.businesses b
join public.categories c        on c.id = b.category_id
left join public.ai_summaries s on s.business_id = b.id;

create view public.feed_reviews with (security_invoker = true) as
select
  r.id,
  r.business_id,
  r.author_id,
  r.rating,
  r.text,
  r.tags,
  r.video_url,
  r.thumbnail_url                         as poster_url,
  r.moderation_status,
  r.created_at,
  r.published_at,
  r.legit_count                           as like_count,
  0::int                                  as comment_count,
  p.display_name                          as author_display_name,
  p.handle                                as author_handle,
  p.avatar_url                            as author_avatar_url,
  p.tier                                  as author_tier,
  b.name_en                               as business_name,
  b.slug                                  as business_slug,
  b.logo_url                              as business_logo_url,
  b.verified                              as business_verified,
  c.slug                                  as business_category_id
from public.reviews r
left join public.profiles p on p.id = r.author_id
join public.businesses b    on b.id = r.business_id
join public.categories c    on c.id = b.category_id;

-- Web RAG search: same signature, now joins the new tables (category = slug).
create or replace function public.match_reviews(
  query_embedding vector,
  match_count integer default 8,
  filter_category text default null
)
returns table(
  id uuid, business_id uuid, business_name text, category_id text,
  text text, rating integer, tags text[], similarity double precision
)
language sql
stable
set search_path = public
as $$
  select r.id, r.business_id, b.name_en as business_name, c.slug as category_id,
         r.text, r.rating, r.tags,
         1 - (r.embedding <=> query_embedding) as similarity
    from public.reviews r
    join public.businesses b on b.id = r.business_id
    join public.categories c on c.id = b.category_id
   where r.moderation_status = 'published'
     and r.embedding is not null
     and (filter_category is null or c.slug = filter_category)
   order by r.embedding <=> query_embedding
   limit match_count;
$$;
