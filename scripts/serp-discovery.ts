#!/usr/bin/env tsx
/**
 * Discover UAE businesses via SerpAPI's Google Maps engine (≈20 places per search).
 * Phase 1 rebuild — discovery step. Writes raw responses + a summary to data/serp/<run>/;
 * does NOT touch the database (import is a separate, reviewed step).
 *
 *   npx tsx scripts/serp-discovery.ts --run full-uae --dry       # list planned searches, spend nothing
 *   npx tsx scripts/serp-discovery.ts --run full-uae --max 2200  # run, spending at most 2200 searches
 *
 * Paced to 900 searches/hour by default (--per-hour N); the plan's hard limit is 1,000/hour.
 *
 * Runs: pilot-dubai (done), full-uae. Re-running is free for searches already saved — existing
 * response files are reused, so an interrupted run just continues. Requires SERPAPI_KEY in .env.local.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

type Cat = { slug: string; query: string };
type Location = { name: string; city: string };
type Group = { cats: Cat[]; locations: Location[]; pages: number };

// The 51 areas in the `areas` table, with the city Google knows them by.
const AREAS: Location[] = [
  ...['Dubai Marina', 'JBR', 'JLT', 'Downtown Dubai', 'Business Bay', 'DIFC', 'Jumeirah', 'Palm Jumeirah',
    'Mirdif', 'Deira', 'Bur Dubai', 'Al Barsha', 'Al Quoz', 'Dubai Hills', 'Motor City', 'Arabian Ranches',
    'JVC', 'DAMAC Hills', 'Jumeirah Village', 'City Walk', 'Al Wasl', 'Al Safa', 'Umm Suqeim', 'Al Furjan',
    'Discovery Gardens', 'International City', 'Dubai Silicon Oasis'].map(name => ({ name, city: 'Dubai' })),
  ...['Corniche', 'Saadiyat Island', 'Yas Island', 'Reem Island', 'Al Raha', 'Al Reem', 'Khalifa City',
    'Al Mushrif', 'Al Bateen', 'Al Manhal', 'Al Zahiyah', 'Al Maryah Island', 'Masdar City', 'Mussafah']
    .map(name => ({ name, city: 'Abu Dhabi' })),
  { name: 'Al Ain', city: 'Al Ain' },
  ...['Al Majaz', 'Al Khan', 'Al Qasba', 'Al Nahda', 'Al Taawun', 'Al Rolla', 'Al Mamzar', 'Muweilah', 'Al Tay']
    .map(name => ({ name, city: 'Sharjah' })),
];
const CITIES: Location[] = [{ name: 'Dubai', city: '' }, { name: 'Abu Dhabi', city: '' }, { name: 'Sharjah', city: '' }];

const RUNS: Record<string, Group[]> = {
  'pilot-dubai': [{
    cats: [{ slug: 'restaurants', query: 'restaurants' }, { slug: 'dental', query: 'dental clinic' }],
    locations: ['Downtown Dubai', 'Dubai Marina', 'JBR', 'JLT', 'DIFC', 'Deira', 'Bur Dubai', 'Karama', 'Jumeirah',
      'Umm Suqeim', 'Al Barsha', 'Business Bay', 'Al Quoz', 'Mirdif', 'Dubai Hills', 'Palm Jumeirah', 'Al Nahda Dubai',
      'Al Qusais', 'International City', 'Silicon Oasis', 'JVC', 'Motor City', 'Arabian Ranches', 'Discovery Gardens',
      'Al Satwa'].map(name => ({ name, city: '' })),
    pages: 2,
  }],
  'full-uae': [
    { // Dense, everyday places: every area, 2 pages (≈40 results).
      pages: 2, locations: AREAS, cats: [
        { slug: 'restaurants', query: 'restaurants' }, { slug: 'cafes', query: 'cafes' },
        { slug: 'salons-spas', query: 'salon and spa' }, { slug: 'general-clinics', query: 'medical clinic' },
        { slug: 'dental', query: 'dental clinic' }, { slug: 'sports-fitness', query: 'gym' },
      ],
    },
    { // Common local places: every area, 1 page.
      pages: 1, locations: AREAS, cats: [
        { slug: 'bakeries-patisseries', query: 'bakery' }, { slug: 'sweets-desserts', query: 'dessert shop' },
        { slug: 'juice-bars', query: 'juice bar' }, { slug: 'brunch-breakfast', query: 'breakfast restaurant' },
        { slug: 'supermarkets', query: 'supermarket' }, { slug: 'pharmacies', query: 'pharmacy' },
        { slug: 'opticians', query: 'optician' }, { slug: 'aesthetic-clinics', query: 'aesthetic clinic' },
        { slug: 'specialty-clinics', query: 'specialist clinic' }, { slug: 'schools', query: 'private school' },
        { slug: 'nurseries', query: 'nursery' }, { slug: 'family-entertainment', query: 'kids play area' },
        { slug: 'hotels', query: 'hotel' }, { slug: 'garages', query: 'car service garage' },
        { slug: 'car-wash', query: 'car wash' }, { slug: 'pets', query: 'pet shop' },
        { slug: 'furniture', query: 'furniture store' }, { slug: 'florists', query: 'florist' },
        { slug: 'tailors', query: 'tailor' }, { slug: 'electronics', query: 'electronics store' },
        { slug: 'fashion', query: 'clothing store' },
      ],
    },
    { // Sparser or destination places: per city, 4 pages (≈80 results).
      pages: 4, locations: CITIES, cats: [
        { slug: 'hospitals', query: 'private hospital' }, { slug: 'wellness', query: 'wellness center' },
        { slug: 'fitness-nutrition', query: 'nutritionist' }, { slug: 'tutoring', query: 'tutoring center' },
        { slug: 'kids-parties', query: 'kids party venue' }, { slug: 'kids-shops', query: 'toy store' },
        { slug: 'maternity-baby', query: 'baby store' }, { slug: 'beach-clubs', query: 'beach club' },
        { slug: 'cinemas', query: 'cinema' }, { slug: 'theme-parks', query: 'theme park' },
        { slug: 'outdoor-activities', query: 'outdoor activities' }, { slug: 'cultural-sites', query: 'museum' },
        { slug: 'nightlife', query: 'nightclub' }, { slug: 'bars-lounges', query: 'lounge bar' },
        { slug: 'tours', query: 'tour operator' }, { slug: 'car-dealers', query: 'car dealership' },
        { slug: 'car-rental', query: 'car rental' }, { slug: 'driving-schools', query: 'driving school' },
        { slug: 'shopping-malls', query: 'shopping mall' }, { slug: 'wedding-venues', query: 'wedding venue' },
        { slug: 'event-venues', query: 'event venue' }, { slug: 'event-catering', query: 'event entertainment company' },
        { slug: 'caterers', query: 'catering company' }, { slug: 'home-services', query: 'cleaning company' },
        { slug: 'jewellery', query: 'jewellery store' }, { slug: 'hardware-diy', query: 'hardware store' },
        { slug: 'appliances', query: 'home appliances store' }, { slug: 'kitchenware', query: 'kitchenware store' },
        { slug: 'bedding-linens', query: 'bedding store' }, { slug: 'garden', query: 'garden center' },
        { slug: 'photography', query: 'photography studio' }, { slug: 'street-food', query: 'food truck' },
        { slug: 'specialty-food', query: 'specialty food store' },
      ],
    },
  ],
};

const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const RUN = arg('--run') ?? 'pilot-dubai';
const DRY = args.includes('--dry');
const MAX = Number(arg('--max')) || 0;
const CONCURRENCY = Number(arg('--concurrency')) || 4;
// SerpAPI Developer plan allows 1,000 searches/hour; stay safely under it across all workers.
const PER_HOUR = Number(arg('--per-hour')) || 900;
let nextSlot = 0;
async function rateLimit() {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + 3_600_000 / PER_HOUR;
  if (at > now) await new Promise(r => setTimeout(r, at - now));
}
if (!RUNS[RUN]) throw new Error(`Unknown run "${RUN}". Known: ${Object.keys(RUNS).join(', ')}`);
const OUT = join('data', 'serp', RUN);

// One task = one category in one location; its pages are fetched in order (page 2 needs page 1's link).
type Task = { cat: Cat; loc: Location; pages: number };
const tasks: Task[] = RUNS[RUN].flatMap(g => g.cats.flatMap(cat => g.locations.map(loc => ({ cat, loc, pages: g.pages }))));
const fileFor = (t: Task, page: number) => join(OUT, `${t.cat.slug}__${t.loc.name.replace(/\W+/g, '-')}__p${page}.json`);
const queryFor = (t: Task) => `${t.cat.query} in ${t.loc.name}${t.loc.city ? `, ${t.loc.city}` : ''}, UAE`;

async function getJson(url: string) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    const body = (await res.text()).slice(0, 300);
    if (attempt >= 3 || res.status < 500 && res.status !== 429) throw new Error(`HTTP ${res.status}: ${body}`);
    await new Promise(r => setTimeout(r, 5000 * attempt));
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const totalPages = tasks.reduce((n, t) => n + t.pages, 0);
  const pending = tasks.flatMap(t => Array.from({ length: t.pages }, (_, p) => fileFor(t, p))).filter(f => !existsSync(f)).length;
  console.log(`Run ${RUN}: ${tasks.length} category×location tasks, up to ${totalPages} searches, ${pending} not yet saved.`);
  console.log('(Second+ pages are only spent when Google has more results, so the real count is usually lower.)');

  if (DRY) { tasks.slice(0, 8).forEach(t => console.log(`  ${queryFor(t)}  ×${t.pages} page(s)`)); return; }
  if (!MAX) throw new Error('Pass --max N to cap how many searches may be spent.');

  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error('Set SERPAPI_KEY in .env.local');
  const account = await getJson(`https://serpapi.com/account.json?api_key=${key}`); // free, not a search
  console.log(`SerpAPI plan: ${account.plan_name}, searches left this month: ${account.total_searches_left}`);
  const budget = Math.min(MAX, account.total_searches_left);

  let spent = 0, done = 0, failed = 0;
  const queue = [...tasks];
  async function worker() {
    for (let t = queue.shift(); t; t = queue.shift()) {
      for (let page = 0; page < t.pages; page++) {
        const file = fileFor(t, page);
        if (existsSync(file)) continue;
        let url: string;
        if (page === 0) {
          url = 'https://serpapi.com/search.json?' + new URLSearchParams({
            engine: 'google_maps', type: 'search', q: queryFor(t), hl: 'en', gl: 'ae', api_key: key!,
          });
        } else {
          const next = JSON.parse(readFileSync(fileFor(t, page - 1), 'utf8')).serpapi_pagination?.next;
          if (!next) { writeFileSync(file, JSON.stringify({ local_results: [], note: 'no next page' })); continue; }
          url = `${next}&api_key=${key}`;
        }
        if (spent >= budget) return;
        spent++;
        await rateLimit();
        try {
          const data = await getJson(url);
          writeFileSync(file, JSON.stringify(data));
        } catch (e) {
          failed++;
          console.error(`  failed: ${queryFor(t)} p${page + 1}: ${(e as Error).message}`);
          break; // later pages depend on this one; a re-run retries
        }
      }
      if (++done % 25 === 0) console.log(`  ${done}/${tasks.length} tasks, ${spent} searches spent`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Done: ${spent} searches spent, ${failed} failed${spent >= budget ? ' (stopped at the --max cap)' : ''}.`);
  summarise();
}

function summarise() {
  const byPlace = new Map<string, any>();
  let raw = 0;
  for (const f of readdirSync(OUT).filter(f => /__p\d+\.json$/.test(f))) {
    const slug = f.split('__')[0];
    for (const r of JSON.parse(readFileSync(join(OUT, f), 'utf8')).local_results ?? []) {
      raw++;
      const id = r.place_id ?? r.data_id ?? `${r.title}|${r.address}`;
      if (!byPlace.has(id)) byPlace.set(id, { ...r, _slug: slug });
    }
  }
  const places = [...byPlace.values()];
  const pct = (n: number) => `${n} (${Math.round((100 * n) / Math.max(places.length, 1))}%)`;
  const slugs = [...new Set(places.map(p => p._slug))];
  const stats = {
    raw_results: raw,
    unique_places: places.length,
    with_website: pct(places.filter(p => p.website).length),
    with_phone: pct(places.filter(p => p.phone).length),
    with_hours: pct(places.filter(p => p.operating_hours || p.hours).length),
    with_gps: pct(places.filter(p => p.gps_coordinates).length),
    with_30plus_google_reviews: pct(places.filter(p => (p.reviews ?? 0) >= 30).length),
    by_category: Object.fromEntries(slugs.map(s => [s, places.filter(p => p._slug === s).length])),
  };
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(stats, null, 2));
  const cols = ['_slug', 'title', 'type', 'address', 'rating', 'reviews', 'website', 'phone', 'place_id'];
  writeFileSync(join(OUT, 'places.csv'),
    [cols.join(','), ...places.map(p => cols.map(c => JSON.stringify(p[c] ?? '')).join(','))].join('\n'));
  const { by_category, ...headline } = stats;
  console.log(JSON.stringify(headline, null, 2));
  console.log(`Wrote ${join(OUT, 'places.csv')}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
