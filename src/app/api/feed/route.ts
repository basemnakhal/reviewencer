/**
 * GET /api/feed?cursor=<iso>&limit=20&category=banking
 *
 * Returns published video reviews, newest-first, for the mobile Feed surface
 * and the desktop "live phone preview" swipeable panel. Cursor-based pagination
 * on published_at — clients pass the last `published_at` they saw.
 *
 * Open endpoint.
 */
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { err, json } from '@/lib/api';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor');
  const limit  = Math.min(Number(url.searchParams.get('limit') ?? 20), 50);
  const category = url.searchParams.get('category');
  const onlyVideo = url.searchParams.get('onlyVideo') !== '0';

  const supa = createSupabaseServiceClient();
  let q = supa
    .from('reviews')
    .select(`
      id, rating, text, tags, video_url, transcript_source, published_at,
      business:businesses!inner(id, slug, name:name_en, logo_url, category:categories!inner(slug)),
      author:profiles(id, handle, display_name, avatar_url)
    `)
    .eq('moderation_status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (onlyVideo) q = q.not('video_url', 'is', null);
  if (cursor)    q = q.lt('published_at', cursor);
  if (category)  q = q.eq('business.category.slug', category);

  const { data, error } = await q;
  if (error) return err(error.message, 500);

  const nextCursor = data && data.length === limit ? data[data.length - 1].published_at : null;
  return json({ items: data ?? [], nextCursor });
}
