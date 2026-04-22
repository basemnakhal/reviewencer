/**
 * Backfill embeddings for reviews missing them.
 *
 *   pnpm embed:backfill           # process all rows
 *   pnpm embed:backfill -- 200    # cap batch size
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL.
 */
import 'dotenv/config';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { embedAndStoreReview }          from '@/lib/embeddings';

const LIMIT = Number(process.argv[2] ?? 500);

async function main() {
  const sb = createSupabaseServiceClient();
  console.log(`🔎 Looking for up to ${LIMIT} reviews without embeddings…`);

  const { data, error } = await sb
    .from('reviews')
    .select('id')
    .is('embedding', null)
    .eq('moderation_status', 'published')
    .limit(LIMIT);

  if (error) { console.error(error); process.exit(1); }
  if (!data?.length) { console.log('✅ Nothing to backfill.'); return; }

  console.log(`⚙️  Embedding ${data.length} reviews…`);
  let ok = 0, fail = 0;
  for (const row of data) {
    try {
      await embedAndStoreReview(row.id);
      ok++;
      process.stdout.write('.');
    } catch (e) {
      fail++;
      process.stdout.write('x');
    }
  }
  console.log(`\n✅ Done. ${ok} embedded, ${fail} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
