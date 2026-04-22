/**
 * Rebuild stale AI summaries.
 *
 *   pnpm summaries:rebuild
 *
 * Iterates every business whose `ai_summaries.stale = true` and regenerates
 * headline / pros / cons / themes / sentiment via Claude.
 */
import 'dotenv/config';
import { rebuildStaleSummaries } from '@/lib/summaries';

async function main() {
  console.log('🔎 Rebuilding stale summaries…');
  const ids = await rebuildStaleSummaries();
  console.log(`✅ Rebuilt ${ids.length} summaries.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
