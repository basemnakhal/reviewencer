-- Reviewencer schema
-- Run: psql "$SUPABASE_DB_URL" -f supabase/schema.sql

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------- Enums ----------
do $$ begin
  create type moderation_status as enum ('pending', 'auto_approved', 'flagged', 'rejected', 'published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type risk_category as enum (
    'defamation',            -- accusations of specific crimes without proof
    'insult',                -- insulting language, slurs
    'commercial_disparage',  -- unfounded disparagement of a business
    'religion_politics',     -- religious/political content (UAE-sensitive)
    'private_info',          -- personal info of named individuals
    'hate_speech',           -- discrimination on protected grounds
    'spam_fake',             -- fake review or spam
    'low_risk'               -- nothing to flag
  );
exception when duplicate_object then null; end $$;

-- ---------- Profiles (extends auth.users) ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  handle       text unique,
  display_name text,
  avatar_url   text,
  role         text not null default 'user' check (role in ('user','moderator','admin')),
  created_at   timestamptz not null default now()
);

-- ---------- Categories ----------
create table if not exists public.categories (
  id     text primary key,  -- slug e.g. 'banking'
  label  text not null,
  emoji  text,
  tint   text               -- tailwind gradient classes
);

-- ---------- Businesses ----------
create table if not exists public.businesses (
  id          uuid primary key default uuid_generate_v4(),
  slug        text unique not null,
  name        text not null,
  category_id text not null references public.categories(id),
  tagline     text,
  logo_emoji  text,
  brand_color text,
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists businesses_category_idx on public.businesses(category_id);

-- ---------- Reviews ----------
create table if not exists public.reviews (
  id                    uuid primary key default uuid_generate_v4(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  author_id             uuid references public.profiles(id) on delete set null,
  rating                int not null check (rating between 1 and 5),
  text                  text not null,
  video_url             text,           -- signed URL or Mux playback id
  transcript_source     text default 'typed' check (transcript_source in ('typed','video_transcription')),
  tags                  text[] not null default '{}',
  moderation_status     moderation_status not null default 'pending',
  moderation_rationale  text,           -- Claude's explanation if flagged/rejected
  risk_categories       risk_category[] not null default '{}',
  embedding             vector(1536),   -- text-embedding-3-small
  created_at            timestamptz not null default now(),
  published_at          timestamptz
);
create index if not exists reviews_business_idx   on public.reviews(business_id, published_at desc);
create index if not exists reviews_moderation_idx on public.reviews(moderation_status);
create index if not exists reviews_embedding_idx  on public.reviews using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ---------- Moderation events (audit trail) ----------
create table if not exists public.moderation_events (
  id               uuid primary key default uuid_generate_v4(),
  review_id        uuid not null references public.reviews(id) on delete cascade,
  actor_id         uuid references public.profiles(id),
  actor_type       text not null check (actor_type in ('ai','moderator','admin','system')),
  from_status      moderation_status,
  to_status        moderation_status not null,
  rationale        text,
  risk_categories  risk_category[] not null default '{}',
  model            text,             -- e.g. 'claude-sonnet-4-6'
  created_at       timestamptz not null default now()
);
create index if not exists moderation_events_review_idx on public.moderation_events(review_id, created_at desc);

-- ---------- AI summaries (per business) ----------
create table if not exists public.ai_summaries (
  business_id       uuid primary key references public.businesses(id) on delete cascade,
  headline          text not null,
  pros              text[] not null default '{}',
  cons              text[] not null default '{}',
  themes            jsonb not null default '[]'::jsonb,  -- [{label, score}]
  sentiment         int,                                  -- 0..100
  review_count      int not null default 0,
  avg_rating        numeric(2,1),
  generated_by      text,                                 -- model name
  generated_at      timestamptz not null default now(),
  stale             boolean not null default false        -- set true when a new review is published
);

-- ---------- Chat logs (optional, helps improve retrieval) ----------
create table if not exists public.chat_messages (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid not null,
  role          text not null check (role in ('user','assistant')),
  content       text not null,
  cited_reviews uuid[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- ---------- Views ----------
create or replace view public.business_cards as
  select b.id, b.slug, b.name, b.tagline, b.logo_emoji, b.brand_color,
         b.verified, b.category_id,
         coalesce(s.headline, '')           as ai_headline,
         coalesce(s.sentiment, 0)           as sentiment,
         coalesce(s.review_count, 0)        as review_count,
         coalesce(s.avg_rating, 0)          as avg_rating,
         coalesce(s.themes, '[]'::jsonb)    as themes
    from public.businesses b
    left join public.ai_summaries s on s.business_id = b.id;

-- Feed-style review view with denormalized author + business fields for homepage/feed
create or replace view public.feed_reviews as
  select
    r.id,
    r.business_id,
    r.author_id,
    r.rating,
    r.text,
    r.tags,
    r.video_url,
    r.moderation_status,
    r.created_at,
    r.published_at,
    0::int                   as like_count,
    0::int                   as comment_count,
    null::text               as poster_url,
    p.display_name           as author_display_name,
    p.handle                 as author_handle,
    p.avatar_url             as author_avatar_url,
    b.name                   as business_name,
    b.slug                   as business_slug,
    b.logo_emoji             as business_logo_emoji,
    b.verified               as business_verified,
    b.category_id            as business_category_id
  from public.reviews r
  left join public.profiles p   on p.id = r.author_id
  join        public.businesses b on b.id = r.business_id;

-- ---------- Semantic search function ----------
-- Given a query embedding, return top-N published reviews across all businesses
create or replace function public.match_reviews(
  query_embedding vector(1536),
  match_count int default 8,
  filter_category text default null
)
returns table(
  id uuid, business_id uuid, business_name text, category_id text,
  text text, rating int, tags text[], similarity float
) language sql stable as $$
  select r.id, r.business_id, b.name as business_name, b.category_id,
         r.text, r.rating, r.tags,
         1 - (r.embedding <=> query_embedding) as similarity
    from public.reviews r
    join public.businesses b on b.id = r.business_id
   where r.moderation_status = 'published'
     and r.embedding is not null
     and (filter_category is null or b.category_id = filter_category)
   order by r.embedding <=> query_embedding
   limit match_count;
$$;

-- ---------- RLS ----------
alter table public.profiles          enable row level security;
alter table public.businesses        enable row level security;
alter table public.categories        enable row level security;
alter table public.reviews           enable row level security;
alter table public.ai_summaries      enable row level security;
alter table public.moderation_events enable row level security;
alter table public.chat_messages     enable row level security;

-- Public read of categories, businesses, published reviews, summaries
drop policy if exists "public read categories"  on public.categories;
drop policy if exists "public read businesses"  on public.businesses;
drop policy if exists "public read reviews"     on public.reviews;
drop policy if exists "public read summaries"   on public.ai_summaries;
drop policy if exists "public read profiles"    on public.profiles;

create policy "public read categories"  on public.categories  for select using (true);
create policy "public read businesses"  on public.businesses  for select using (true);
create policy "public read summaries"   on public.ai_summaries for select using (true);
create policy "public read profiles"    on public.profiles    for select using (true);
-- Only published reviews are public; authors can see their own drafts
create policy "public read reviews"     on public.reviews
  for select using (
    moderation_status = 'published'
    or author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderator','admin'))
  );

-- Write policies
drop policy if exists "users insert own review" on public.reviews;
create policy "users insert own review" on public.reviews
  for insert with check (auth.uid() = author_id);

drop policy if exists "users update own pending review" on public.reviews;
create policy "users update own pending review" on public.reviews
  for update using (auth.uid() = author_id and moderation_status = 'pending')
             with check (auth.uid() = author_id);

-- Moderators / admins: full control on reviews + moderation events
drop policy if exists "moderators full reviews"   on public.reviews;
drop policy if exists "moderators full events"    on public.moderation_events;
create policy "moderators full reviews" on public.reviews
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderator','admin')));
create policy "moderators full events" on public.moderation_events
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderator','admin')));

-- Chat messages: owner-only read
drop policy if exists "chat owner read" on public.chat_messages;
create policy "chat owner read" on public.chat_messages
  for select using (true);   -- we key by session cookie, not auth, for anon use
drop policy if exists "chat anyone insert" on public.chat_messages;
create policy "chat anyone insert" on public.chat_messages
  for insert with check (true);

-- ---------- Trigger: mark summary stale when a published review lands ----------
create or replace function public.mark_summary_stale() returns trigger language plpgsql as $$
begin
  if new.moderation_status = 'published' and (old is null or old.moderation_status <> 'published') then
    insert into public.ai_summaries (business_id, headline, review_count)
      values (new.business_id, '', 0)
      on conflict (business_id) do update set stale = true;
  end if;
  return new;
end; $$;

drop trigger if exists reviews_stale_summary on public.reviews;
create trigger reviews_stale_summary
  after insert or update of moderation_status on public.reviews
  for each row execute function public.mark_summary_stale();
