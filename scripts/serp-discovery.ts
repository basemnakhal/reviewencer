#!/usr/bin/env tsx
/**
 * Discover UAE businesses via SerpAPI's Google Maps engine (≈20 places per search).
 * Phase 1 rebuild — discovery step. Writes raw responses + a summary to data/serp/<run>/;
 * does NOT touch the database (import is a separate, reviewed step).
 *
 *   npx tsx scripts/serp-discovery.ts --dry            # list planned searches, spend nothing
 *   npx tsx scripts/serp-discovery.ts --max 100        # run the pilot, at most 100 searches
 *
 * Re-running is free for searches already saved: existing response files are reused.
 * Requires SERPAPI_KEY in .env.local.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RUN = 'pilot-dubai';
const OUT = join('data', 'serp', RUN);

// Pilot: two contrasting categories (food = huge & noisy, dental = regulated & tidy) across Dubai.
const CATEGORIES = [
  { slug: 'restaurants', query: 'restaurants' },
  { slug: 'dental',      query: 'dental clinic' },
];
const AREAS = [
  'Downtown Dubai', 'Dubai Marina', 'JBR', 'JLT', 'DIFC', 'Deira', 'Bur Dubai', 'Karama',
  'Jumeirah', 'Umm Suqeim', 'Al Barsha', 'Business Bay', 'Al Quoz', 'Mirdif', 'Dubai Hills',
  'Palm Jumeirah', 'Al Nahda Dubai', 'Al Qusais', 'International City', 'Silicon Oasis',
  'JVC', 'Motor City', 'Arabian Ranches', 'Discovery Gardens', 'Al Satwa',
];
const PAGES = 2; // 20 results per page

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const MAX = Number(args[args.indexOf('--max') + 1]) || 0;

type Planned = { slug: string; area: string; page: number; file: string };
const planned: Planned[] = CATEGORIES.flatMap(c => AREAS.flatMap(area =>
  Array.from({ length: PAGES }, (_, i) => ({
    slug: c.slug, area, page: i,
    file: join(OUT, `${c.slug}__${area.replace(/\W+/g, '-')}__p${i}.json`),
  }))));
const queryFor = (p: Planned) => `${CATEGORIES.find(c => c.slug === p.slug)!.query} in ${p.area}, UAE`;

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const todo = planned.filter(p => !existsSync(p.file));
  console.log(`Planned ${planned.length} searches, ${planned.length - todo.length} already saved, ${todo.length} to run.`);

  if (DRY) { todo.slice(0, 10).forEach(p => console.log(`  ${queryFor(p)}  (page ${p.page + 1})`)); return; }
  if (!MAX) throw new Error('Pass --max N to cap how many searches may be spent.');

  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error('Set SERPAPI_KEY in .env.local');

  const account = await getJson(`https://serpapi.com/account.json?api_key=${key}`); // free, not a search
  console.log(`SerpAPI plan: ${account.plan_name}, searches left this month: ${account.total_searches_left}`);
  if (account.total_searches_left < Math.min(MAX, todo.length)) throw new Error('Not enough searches left for this run.');

  let spent = 0;
  for (const p of todo) {
    if (spent >= MAX) break;
    let url: string;
    if (p.page === 0) {
      url = 'https://serpapi.com/search.json?' + new URLSearchParams({
        engine: 'google_maps', type: 'search', q: queryFor(p), hl: 'en', gl: 'ae', api_key: key,
      });
    } else {
      // Follow SerpAPI's own "next page" link from the previous page so paging params are right.
      const prevFile = p.file.replace(/__p\d+\.json$/, `__p${p.page - 1}.json`);
      if (!existsSync(prevFile)) continue;
      const next = JSON.parse(readFileSync(prevFile, 'utf8')).serpapi_pagination?.next;
      if (!next) { writeFileSync(p.file, JSON.stringify({ local_results: [], note: 'no next page' })); continue; }
      url = `${next}&api_key=${key}`;
    }
    const data = await getJson(url);
    spent++;
    writeFileSync(p.file, JSON.stringify(data));
    console.log(`[${spent}/${MAX}] ${queryFor(p)} p${p.page + 1}: ${(data.local_results ?? []).length} places`);
  }
  console.log(`Spent ${spent} searches.`);
  summarise();
}

function summarise() {
  const byPlace = new Map<string, any>();
  let raw = 0;
  for (const f of readdirSync(OUT).filter(f => f.endsWith('.json') && f !== 'summary.json')) {
    const slug = f.split('__')[0];
    for (const r of JSON.parse(readFileSync(join(OUT, f), 'utf8')).local_results ?? []) {
      raw++;
      const id = r.place_id ?? r.data_id ?? `${r.title}|${r.address}`;
      if (!byPlace.has(id)) byPlace.set(id, { ...r, _slug: slug });
    }
  }
  const places = [...byPlace.values()];
  const pct = (n: number) => `${n} (${Math.round((100 * n) / Math.max(places.length, 1))}%)`;
  const stats = {
    raw_results: raw,
    unique_places: places.length,
    with_website: pct(places.filter(p => p.website).length),
    with_phone: pct(places.filter(p => p.phone).length),
    with_hours: pct(places.filter(p => p.operating_hours || p.hours).length),
    with_gps: pct(places.filter(p => p.gps_coordinates).length),
    with_30plus_google_reviews: pct(places.filter(p => (p.reviews ?? 0) >= 30).length),
    by_category: Object.fromEntries(CATEGORIES.map(c => [c.slug, places.filter(p => p._slug === c.slug).length])),
  };
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(stats, null, 2));
  const cols = ['_slug', 'title', 'type', 'address', 'rating', 'reviews', 'website', 'phone', 'place_id'];
  const csv = [cols.join(','), ...places.map(p => cols.map(c => JSON.stringify(p[c] ?? '')).join(','))].join('\n');
  writeFileSync(join(OUT, 'places.csv'), csv);
  console.log(JSON.stringify(stats, null, 2));
  console.log(`Wrote ${join(OUT, 'places.csv')}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
