#!/usr/bin/env tsx
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? (() => { throw new Error('Set NEXT_PUBLIC_SUPABASE_URL in .env.local'); })();
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in .env.local'); })();
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { count, error } = await sb.from('businesses').select('*', { count: 'exact', head: true });
  if (error) { console.error('Error:', error.message); process.exit(1); }
  console.log(`Total businesses in DB: ${count}`);

  const { data: byCat, error: e2 } = await sb
    .from('businesses')
    .select('category_id')
    .order('category_id');
  if (e2) { console.error('Error:', e2.message); process.exit(1); }

  const counts: Record<string, number> = {};
  for (const r of byCat ?? []) {
    counts[r.category_id] = (counts[r.category_id] ?? 0) + 1;
  }
  console.log('\nPer category:');
  for (const [cat, n] of Object.entries(counts).sort()) {
    console.log(`  ${cat.padEnd(20)} ${n}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
