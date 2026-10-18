#!/usr/bin/env tsx
/**
 * Enrich all businesses with Google Places data.
 *
 * Fetches per business (1 API call):
 *   address, area, city, phone, website, opening_hours,
 *   google_rating, google_review_count, latitude, longitude,
 *   cover_photo_url, logo_url (Clearbit)
 *
 * Resume-safe: skips rows where address IS NOT NULL.
 * Run: tsx scripts/enrich-businesses.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? (() => { throw new Error('Set NEXT_PUBLIC_SUPABASE_URL in .env.local'); })();
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? (() => { throw new Error('Set SUPABASE_SERVICE_ROLE_KEY in .env.local'); })();
const GOOGLE_KEY   = process.env.GOOGLE_PLACES_API_KEY ?? (() => { throw new Error('Set GOOGLE_PLACES_API_KEY in .env.local'); })();

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const UAE_CITIES = [
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman',
  'Ras Al Khaimah', 'Fujairah', 'Al Ain', 'Umm Al Quwain',
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── address parsing ───────────────────────────────────────────────────────────
function parseCity(address: string): string {
  for (const city of UAE_CITIES) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(address)) return city;
  }
  return '';
}

function parseArea(address: string, city: string): string {
  if (!city) return '';
  const parts = address.split(',').map(p => p.trim().replace(/ - $/, ''));
  const cityIdx = parts.findIndex(p => new RegExp(`\\b${city}\\b`, 'i').test(p));
  if (cityIdx <= 0) return '';
  for (let i = cityIdx - 1; i >= 0; i--) {
    const candidate = parts[i];
    if (/^[\d\s]+$/.test(candidate)) continue;        // skip bare numbers
    if (/\bPO Box\b/i.test(candidate)) continue;      // skip PO boxes
    if (/^[A-Z]{1,3}\d/.test(candidate)) continue;    // skip unit refs like "B101"
    return candidate;
  }
  return '';
}

// ── Google Places API ─────────────────────────────────────────────────────────
interface PlaceCandidate {
  place_id?: string;
  formatted_address?: string;
  geometry?: { location: { lat: number; lng: number } };
  international_phone_number?: string;
  website?: string;
  opening_hours?: { weekday_text?: string[] };
  photos?: Array<{ photo_reference: string }>;
  rating?: number;
  user_ratings_total?: number;
}

async function findPlace(name: string): Promise<PlaceCandidate | null> {
  const fields = [
    'place_id',
    'formatted_address',
    'geometry',
    'international_phone_number',
    'website',
    'opening_hours',
    'photos',
    'rating',
    'user_ratings_total',
  ].join(',');

  const params = new URLSearchParams({
    input: name,
    inputtype: 'textquery',
    fields,
    locationbias: 'rectangle:22.6332,51.5795|26.0842,56.3834', // UAE bounding box
    key: GOOGLE_KEY,
    language: 'en',
  });

  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`,
      { signal: AbortSignal.timeout(10000) },
    );
    const data = await r.json() as any;
    if (data.status !== 'OK' || !data.candidates?.length) return null;
    return data.candidates[0];
  } catch { return null; }
}

async function fetchPhotoUrl(photoRef: string): Promise<string | null> {
  const params = new URLSearchParams({
    maxwidth: '1200',
    photoreference: photoRef,
    key: GOOGLE_KEY,
  });
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/place/photo?${params}`,
      { redirect: 'manual', signal: AbortSignal.timeout(8000) },
    );
    return r.headers.get('location') ?? null;
  } catch { return null; }
}

async function clearbitLogo(website: string): Promise<string | null> {
  try {
    const domain = new URL(website.startsWith('http') ? website : `https://${website}`)
      .hostname.replace(/^www\./, '');
    const url = `https://logo.clearbit.com/${domain}`;
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    return r.ok ? url : null;
  } catch { return null; }
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄  Enriching businesses with Google Places data...\n');

  // Load all unenriched businesses (resume-safe: address IS NULL)
  const PAGE = 1000;
  let offset = 0;
  const businesses: Array<{ id: string; name: string }> = [];
  while (true) {
    const { data, error } = await sb
      .from('businesses')
      .select('id, name')
      .is('address', null)
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data?.length) break;
    businesses.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  const total = businesses.length;
  console.log(`Found ${total} businesses to enrich.\n`);

  let enriched = 0, notFound = 0, failed = 0;

  for (let i = 0; i < businesses.length; i++) {
    const biz = businesses[i];
    const place = await findPlace(biz.name);

    if (!place) {
      notFound++;
      await sleep(150);
      if ((i + 1) % 50 === 0 || i === total - 1) {
        process.stdout.write(`\r[${i + 1}/${total}]  ✅ ${enriched}  ❓ ${notFound}  ❌ ${failed}   `);
      }
      continue;
    }

    // Parse city / area from formatted_address
    const city = place.formatted_address ? parseCity(place.formatted_address) : '';
    const area = place.formatted_address ? parseArea(place.formatted_address, city) : '';

    // Cover photo (Google Places photo)
    let coverPhotoUrl: string | null = null;
    if (place.photos?.length) {
      coverPhotoUrl = await fetchPhotoUrl(place.photos[0].photo_reference);
      await sleep(80);
    }

    // Logo: Clearbit only
    let logoUrl: string | null = null;
    if (place.website) {
      logoUrl = await clearbitLogo(place.website);
    }

    // Construct Google Maps URL from place_id
    const mapsUrl = place.place_id
      ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
      : null;

    const update: Record<string, unknown> = {};
    if (place.formatted_address)                  update.address            = place.formatted_address;
    if (area)                                      update.area               = area;
    if (city)                                      update.city               = city;
    if (place.international_phone_number)          update.phone              = place.international_phone_number;
    if (place.website)                             update.website            = place.website;
    if (mapsUrl)                                   update.google_maps_url    = mapsUrl;
    if (coverPhotoUrl)                             update.cover_photo_url    = coverPhotoUrl;
    if (logoUrl)                                   update.logo_url           = logoUrl;
    if (place.opening_hours?.weekday_text?.length) update.opening_hours      = place.opening_hours.weekday_text;
    if (place.rating != null)                      update.google_rating      = place.rating;
    if (place.user_ratings_total != null)          update.google_review_count = place.user_ratings_total;
    if (place.geometry?.location) {
      update.latitude  = place.geometry.location.lat;
      update.longitude = place.geometry.location.lng;
    }

    const { error } = await sb.from('businesses').update(update).eq('id', biz.id);
    if (error) {
      failed++;
      console.error(`\n⚠️  Update failed for "${biz.name}": ${error.message}`);
    } else {
      enriched++;
    }

    if ((i + 1) % 50 === 0 || i === total - 1) {
      process.stdout.write(`\r[${i + 1}/${total}]  ✅ ${enriched}  ❓ ${notFound}  ❌ ${failed}   `);
    }

    await sleep(150);
  }

  console.log('\n');
  console.log('══════════════════════════════════');
  console.log(`  Enriched  : ${enriched}`);
  console.log(`  Not found : ${notFound}`);
  console.log(`  Failed    : ${failed}`);
  console.log(`  Total     : ${total}`);
  console.log('══════════════════════════════════\n');
}

main().catch(e => { console.error(e); process.exit(1); });
