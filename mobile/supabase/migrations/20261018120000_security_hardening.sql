-- ============================================================
-- Security hardening (advisor findings + client write access)
-- ============================================================

-- 1. Views run with the caller's permissions, so RLS on the underlying
--    tables applies instead of the view owner's.
alter view public.legacy_business_cards set (security_invoker = true);
alter view public.user_tiers set (security_invoker = true);

-- 2. Trigger/internal SECURITY DEFINER functions are not part of the API.
--    (Triggers still fire: EXECUTE is not checked when a trigger runs.)
revoke execute on function public.recalculate_tier(uuid) from public, anon, authenticated;
revoke execute on function public.sync_legit_count_and_tier() from public, anon, authenticated;
revoke execute on function public.trigger_sync_author_tier() from public, anon, authenticated;

-- 3. RLS helper moves to a schema the Data API doesn't expose, so policies can
--    still call it but /rest/v1/rpc can't.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_moderator_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('moderator', 'admin')
  );
$$;
revoke execute on function private.is_moderator_or_admin() from public;
grant execute on function private.is_moderator_or_admin() to anon, authenticated;

drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select" on public.reviews
for select to anon, authenticated
using (
  moderation_status = 'published'
  or (select auth.uid()) = author_id
  or private.is_moderator_or_admin()
);

drop policy if exists "reviews_moderator_all" on public.reviews;
create policy "reviews_moderator_all" on public.reviews
for all to authenticated
using (private.is_moderator_or_admin())
with check (private.is_moderator_or_admin());

drop function if exists public.is_moderator_or_admin();

-- 4. Pin search_path on the remaining functions.
alter function public.match_reviews(vector, integer, text) set search_path = public;
alter function public.mark_summary_stale() set search_path = public;
alter function public.sync_legit_count_and_tier() set search_path = public;
alter function public.trigger_set_updated_at() set search_path = public;

-- 5. Profiles: users could previously set their own role (→ admin) and tier.
--    Only the columns the apps actually write stay writable.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, handle, display_name, avatar_url, phone, language) on public.profiles to authenticated;
grant update (handle, display_name, avatar_url, phone, language) on public.profiles to authenticated;

-- 6. Reviews: inserts were open to anon with `with check (true)`, so anyone
--    could post as anyone, already published, with any counters.
drop policy if exists "reviews_insert" on public.reviews;
create policy "reviews_insert" on public.reviews
for insert to authenticated
with check ((select auth.uid()) = author_id and moderation_status = 'pending');

revoke insert, update on public.reviews from anon, authenticated;
grant insert (
  business_id, branch_id, author_id, rating, text, tags, language,
  video_url, thumbnail_url, transcript_source, moderation_status,
  transcript, transcript_en, transcript_ar,
  ai_likes, ai_nopes, ai_likes_en, ai_likes_ar, ai_nopes_en, ai_nopes_ar
) on public.reviews to authenticated;
-- Authors may edit the caption of their own pending review (reviews_update_own).
grant update (text, tags) on public.reviews to authenticated;
