#!/usr/bin/env tsx
/**
 * Populate Reviewencer Supabase with UAE businesses via Google Places API.
 *
 * Coverage strategy per category:
 *   • 3 UAE cities (Dubai, Abu Dhabi, Sharjah) + their key sub-areas
 *   • Up to 3 pages (60 results each) per search query
 * Duplicate place_ids are skipped within a run; duplicate slugs are skipped via DB.
 *
 * Logo priority: Clearbit → SerpAPI image search → initials.
 *
 * Run: tsx scripts/populate-uae-businesses.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// ── credentials ───────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? (() => { throw new Error('Set NEXT_PUBLIC_SUPABASE_URL in .env.local'); })();
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in .env.local'); })();
const GOOGLE_KEY   = process.env.GOOGLE_PLACES_API_KEY ?? (() => { throw new Error('Set GOOGLE_PLACES_API_KEY in .env.local'); })();
const SERP_KEY     = process.env.SERPAPI_KEY ?? (() => { throw new Error('Set SERPAPI_KEY in .env.local'); })();

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── geographic scope ──────────────────────────────────────────────────────────
// City-level searches
const CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah'];

// Sub-area searches (appended to each query)
const DUBAI_AREAS = [
  'Downtown Dubai',
  'Dubai Marina',
  'JBR Dubai',
  'JLT Dubai',
  'DIFC Dubai',
  'Deira Dubai',
  'Bur Dubai',
  'Jumeirah Dubai',
  'Business Bay Dubai',
  'Al Quoz Dubai',
  'Mirdif Dubai',
  'Dubai Hills',
  'Palm Jumeirah Dubai',
];

const ABU_DHABI_AREAS = [
  'Khalidiyah Abu Dhabi',
  'Corniche Abu Dhabi',
  'Yas Island Abu Dhabi',
  'Saadiyat Island Abu Dhabi',
  'Al Reem Island Abu Dhabi',
  'Mushrif Abu Dhabi',
];

const SHARJAH_AREAS = [
  'Al Nahda Sharjah',
  'Al Qasimia Sharjah',
  'Al Majaz Sharjah',
  'Muwaileh Sharjah',
];

// ── category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  // ── already populated ──────────────────────────────────────────────────────
  { id: 'salons',          label: 'Salons & Barbers',        emoji: '✂️', tint: 'from-pink-500 to-rose-600',      baseQuery: 'hair salons and barbers',               existsInDb: true  },
  { id: 'spas',            label: 'Spas & Wellness',         emoji: '💆', tint: 'from-teal-500 to-cyan-600',      baseQuery: 'spas and wellness centers',             existsInDb: true  },
  { id: 'schools',         label: 'Schools',                 emoji: '🏫', tint: 'from-lime-500 to-green-600',     baseQuery: 'schools',                              existsInDb: true  },
  { id: 'ride',            label: 'Ride-hailing',            emoji: '🚖', tint: 'from-yellow-500 to-amber-600',   baseQuery: 'ride hailing taxi companies',           existsInDb: true  },
  { id: 'banking',         label: 'Banking',                 emoji: '🏦', tint: 'from-indigo-500 to-blue-600',    baseQuery: 'banks',                                existsInDb: true  },
  { id: 'ecommerce',       label: 'E-commerce',              emoji: '🛒', tint: 'from-amber-500 to-orange-600',   baseQuery: 'ecommerce online shopping',             existsInDb: true  },
  { id: 'delivery',        label: 'Food Delivery',           emoji: '🛵', tint: 'from-rose-500 to-pink-600',      baseQuery: 'food delivery companies',              existsInDb: true  },
  // ── still to populate ─────────────────────────────────────────────────────
  { id: 'restaurants',     label: 'Restaurants & Cafes',     emoji: '🍽️', tint: 'from-red-500 to-orange-600',     baseQuery: 'restaurants and cafes',                existsInDb: false },
  { id: 'hotels',          label: 'Hotels & Resorts',        emoji: '🏨', tint: 'from-amber-500 to-yellow-600',   baseQuery: 'hotels and resorts',                   existsInDb: false },
  { id: 'gyms',            label: 'Gyms & Fitness',          emoji: '💪', tint: 'from-blue-500 to-indigo-600',    baseQuery: 'gyms and fitness centers',             existsInDb: false },
  { id: 'healthcare',      label: 'Healthcare Clinics',      emoji: '🏥', tint: 'from-green-500 to-emerald-600',  baseQuery: 'healthcare medical clinics',            existsInDb: false },
  { id: 'dental',          label: 'Dental Clinics',          emoji: '🦷', tint: 'from-sky-500 to-blue-600',       baseQuery: 'dental clinics',                       existsInDb: false },
  { id: 'kids-play',       label: 'Kids Play Areas',         emoji: '🎠', tint: 'from-yellow-400 to-orange-500',  baseQuery: 'kids indoor play areas',               existsInDb: false },
  { id: 'kids-activities', label: 'Kids Activities',         emoji: '⚽', tint: 'from-emerald-400 to-teal-500',   baseQuery: 'kids gymnastics swimming football clubs', existsInDb: false },
  { id: 'malls',           label: 'Shopping Malls',          emoji: '🛍️', tint: 'from-violet-500 to-purple-600',  baseQuery: 'shopping malls',                       existsInDb: false },
  { id: 'entertainment',   label: 'Entertainment Venues',    emoji: '🎡', tint: 'from-fuchsia-500 to-pink-600',   baseQuery: 'theme parks water parks entertainment', existsInDb: false },
  { id: 'car-dealers',     label: 'Car Dealers',             emoji: '🚗', tint: 'from-slate-500 to-gray-600',     baseQuery: 'car dealers showrooms',                existsInDb: false },
  { id: 'nurseries',       label: 'Nurseries & Daycares',    emoji: '👶', tint: 'from-orange-400 to-amber-500',   baseQuery: 'nurseries and daycares',               existsInDb: false },
  { id: 'realestate',      label: 'Real Estate & Property',  emoji: '🏠', tint: 'from-purple-500 to-fuchsia-600', baseQuery: 'property portals real estate agencies', existsInDb: false },
] as const;

// ── helpers ───────────────────────────────────────────────────────────────────
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function brandColor(name: string): string {
  let h = 0;
  for (const c of name) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  const hue = Math.abs(h) % 360;
  const s = 0.6, l = 0.4;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const val = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * val).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

async function checkUrl(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch { return false; }
}

async function clearbitLogo(website: string): Promise<string | null> {
  try {
    const domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname
      .replace(/^www\./, '');
    const url = `https://logo.clearbit.com/${domain}`;
    return (await checkUrl(url)) ? url : null;
  } catch { return null; }
}

async function serpApiLogo(businessName: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${businessName} logo png`);
    const url = `https://serpapi.com/search.json?engine=google_images&q=${q}&num=1&api_key=${SERP_KEY}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const data = await r.json() as any;
    return data?.images_results?.[0]?.thumbnail ?? null;
  } catch { return null; }
}

function tagline(address: string | undefined, categoryLabel: string): string {
  if (!address) return `${categoryLabel} in the UAE`;
  const city = address.split(',').find(p =>
    /dubai|abu dhabi|sharjah|ajman|ras al|fujairah|al ain/i.test(p)
  )?.trim();
  return city ? `${categoryLabel} in ${city}` : `${categoryLabel} in the UAE`;
}

// ── Google Places API ─────────────────────────────────────────────────────────
interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
}

async function placesTextSearch(
  query: string,
  pageToken?: string,
): Promise<{ results: PlaceResult[]; nextPageToken?: string }> {
  const params = new URLSearchParams({ query, key: GOOGLE_KEY, region: 'ae', language: 'en' });
  if (pageToken) params.set('pagetoken', pageToken);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const data = await r.json() as any;
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`${data.status}${data.error_message ? ': ' + data.error_message : ''}`);
  }
  return { results: data.results ?? [], nextPageToken: data.next_page_token };
}

async function fetchAllPages(query: string, seenIds: Set<string>): Promise<PlaceResult[]> {
  const out: PlaceResult[] = [];
  let token: string | undefined;
  let page = 0;
  while (page < 3) {
    if (page > 0) await sleep(2200); // Places API requires delay before using next_page_token
    let res: { results: PlaceResult[]; nextPageToken?: string };
    try {
      res = await placesTextSearch(query, token);
    } catch (err: any) {
      console.error(`     ⚠️  Places error for "${query}": ${err.message}`);
      break;
    }
    for (const p of res.results) {
      if (!seenIds.has(p.place_id)) {
        seenIds.add(p.place_id);
        out.push(p);
      }
    }
    token = res.nextPageToken;
    page++;
    if (!token) break;
  }
  return out;
}

async function placeDetails(placeId: string): Promise<{ website?: string }> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'website',
    key: GOOGLE_KEY,
  });
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      { signal: AbortSignal.timeout(8000) },
    );
    const data = await r.json() as any;
    return { website: data.result?.website };
  } catch { return {}; }
}

// ── build all search queries for a category ───────────────────────────────────
function searchQueries(baseQuery: string): string[] {
  const queries: string[] = [];
  for (const city of CITIES)         queries.push(`${baseQuery} in ${city}`);
  for (const area of DUBAI_AREAS)    queries.push(`${baseQuery} in ${area}`);
  for (const area of ABU_DHABI_AREAS) queries.push(`${baseQuery} in ${area}`);
  for (const area of SHARJAH_AREAS)  queries.push(`${baseQuery} in ${area}`);
  return queries;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const totalLocations = CITIES.length + DUBAI_AREAS.length + ABU_DHABI_AREAS.length + SHARJAH_AREAS.length;
  console.log('🇦🇪  Reviewencer UAE Business Populator\n');
  console.log(`   Cities       : ${CITIES.join(', ')}`);
  console.log(`   Dubai areas  : ${DUBAI_AREAS.length}`);
  console.log(`   AbuDhabi areas: ${ABU_DHABI_AREAS.length}`);
  console.log(`   Sharjah areas: ${SHARJAH_AREAS.length}`);
  console.log(`   Total queries: ${totalLocations} per category × up to 3 pages = up to ${totalLocations * 60} results per category\n`);

  // 1. Upsert categories ──────────────────────────────────────────────────────
  const newCats = CATEGORIES.filter(c => !c.existsInDb);
  if (newCats.length) {
    const { error } = await sb.from('categories').upsert(
      newCats.map(c => ({ id: c.id, label: c.label, emoji: c.emoji, tint: c.tint })),
      { onConflict: 'id' },
    );
    if (error) { console.error('Failed to upsert categories:', error.message); process.exit(1); }
    console.log(`✅ Upserted ${newCats.length} new categories: ${newCats.map(c => c.id).join(', ')}\n`);
  }

  // 2. Load existing slugs ────────────────────────────────────────────────────
  const { data: existingSlugsData } = await sb.from('businesses').select('slug');
  const slugSet = new Set((existingSlugsData ?? []).map(r => r.slug));
  console.log(`   Loaded ${slugSet.size} existing slugs from DB.\n`);

  // 3. Process only new categories ───────────────────────────────────────────
  const toProcess = CATEGORIES.filter(c => !c.existsInDb);
  console.log(`   Processing ${toProcess.length} new categories: ${toProcess.map(c => c.id).join(', ')}\n`);

  const report: Record<string, { found: number; inserted: number }> = {};

  for (const cat of toProcess) {
    console.log(`\n📍 ${cat.label}`);
    const seenIds = new Set<string>();
    const queries = searchQueries(cat.baseQuery);
    let allPlaces: PlaceResult[] = [];

    // Collect from all city + area searches
    for (let qi = 0; qi < queries.length; qi++) {
      const q = queries[qi];
      const before = allPlaces.length;
      const found = await fetchAllPages(q, seenIds);
      allPlaces.push(...found);
      const added = allPlaces.length - before;
      if (added > 0) process.stdout.write(`   [${qi + 1}/${queries.length}] "${q}" → +${added}\n`);
      await sleep(300);
    }

    console.log(`   Total unique places: ${allPlaces.length}`);
    let inserted = 0;

    for (const place of allPlaces) {
      const name = place.name;
      let slug = toSlug(name);
      if (!slug) continue;

      // Deduplicate slug
      let attempt = slug;
      let suffix = 2;
      while (slugSet.has(attempt)) attempt = `${slug}-${suffix++}`;
      slug = attempt;

      // Website → Clearbit
      await sleep(120);
      const { website } = await placeDetails(place.place_id);

      let logo: string;
      if (website) {
        const cb = await clearbitLogo(website);
        if (cb) {
          logo = cb;
        } else {
          await sleep(120);
          logo = (await serpApiLogo(name)) ?? initials(name);
        }
      } else {
        await sleep(120);
        logo = (await serpApiLogo(name)) ?? initials(name);
      }

      const { error } = await sb.from('businesses').insert({
        slug,
        name,
        category_id: cat.id,
        tagline: tagline(place.formatted_address, cat.label),
        logo_emoji: logo,
        brand_color: brandColor(name),
        verified: false,
      });

      if (error) {
        if (error.code !== '23505') {
          console.error(`   ⚠️  Insert failed for "${name}": ${error.message}`);
        }
        continue;
      }

      slugSet.add(slug);
      inserted++;
      process.stdout.write('.');
    }

    process.stdout.write('\n');
    console.log(`   ✅ Inserted ${inserted} / ${allPlaces.length} into [${cat.id}]`);
    report[cat.id] = { found: allPlaces.length, inserted };
    await sleep(500);
  }

  // 4. Final report ───────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════════════════════');
  console.log('  Results by category');
  console.log('══════════════════════════════════════════════════════');
  let totalFound = 0, totalInserted = 0;
  for (const cat of toProcess) {
    const r = report[cat.id] ?? { found: 0, inserted: 0 };
    totalFound    += r.found;
    totalInserted += r.inserted;
    console.log(`  ${cat.emoji}  ${cat.label.padEnd(26)}  found ${String(r.found).padStart(4)}  inserted ${r.inserted}`);
  }
  console.log('──────────────────────────────────────────────────────');
  console.log(`  TOTAL${' '.repeat(29)}  found ${String(totalFound).padStart(4)}  inserted ${totalInserted}`);
  console.log('══════════════════════════════════════════════════════\n');
}

main().catch(e => { console.error(e); process.exit(1); });
