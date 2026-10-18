# Reviewencer — Phase 1 Build Handoff

**For: Claude Code (Anthropic terminal coding assistant)**
**Status: Ready to execute**
**Owner: Basem**
**Last reviewed: design session 2026**

---

## 0. How to use this document

You are Claude Code. This document is your end-to-end build plan for Reviewencer's Phase 1 data foundation. Execute it in order. Each phase has:

- **Goal** — what success looks like
- **Steps** — what to do
- **Verify** — queries/checks you must run to confirm correctness before moving on
- **Stop conditions** — circumstances where you must halt and ask the user

**Critical rules:**

1. **Run each phase as a single atomic transaction where possible.** Use `BEGIN; ... COMMIT;` for SQL phases. If anything fails, ROLLBACK and report to the user.
2. **Never skip verification steps.** They're cheap insurance against silent corruption.
3. **Halt if reality diverges from expectations.** If row counts, table existence, or schema shape don't match what this doc expects, STOP and report. Do not improvise data fixes.
4. **Halt at human review checkpoints.** Phase E requires Basem's sign-off on the curated CSV before Phase F proceeds. Do not skip.
5. **Preserve idempotency.** Use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, and similar so a partial re-run is safe.
6. **Report progress at each phase boundary** with a short summary (e.g., "Phase A complete: 7 new tables created, 4 legacy tables renamed, 0 errors").

---

## 1. Background and goals

### Why we're doing this

Reviewencer's previous data population (11,039 businesses scraped via Google Places + SerpAPI) produced unusable data:

- Categories were free-text strings with wrong mappings ("Carrefour" tagged as `malls`, etc.)
- Logos were Google favicon URLs, often matched to wrong domains (e.g., "Galadari Driving Centre" was tagged with Carrefour's favicon because "Carrefour" appeared in the address)
- Tagline field contained address strings instead of descriptions
- Chain structure didn't exist — every Carrefour branch was a separate top-level business
- Critical fields missing: no lat/lng, no address column, no phone, no hours, no place_id

This made the existing data **unsalvageable** for the product. Instead of migration, we are doing a **clean rebuild**:

1. Truncate test data (83 reviews, 5 profiles, etc. — all fake)
2. Rename existing business tables to `legacy_*` (preserved dormant for reference)
3. Create new tables with proper schema
4. Seed taxonomy: 3 emirates, ~50 areas, 9 life moments, 66 categories
5. Curate business names from editorial sources (Time Out UAE primarily, plus regulator lists)
6. Enrich each curated business via Google Places API for canonical data
7. Insert with proper chain detection (Carrefour → 1 brand + N branches)

### Design decisions already locked

- **Path A** (fresh rebuild from external sources, not legacy data salvage)
- **Curation-first approach** — every business in Phase 1 comes from an editorial or regulatory source, not bulk Google Places dump
- **Time Out UAE (Dubai, Abu Dhabi, Sharjah) as primary editorial source**
- **Government regulators as secondary sources** for licensed categories (KHDA for schools, DHA/DOH/SHA for clinics, etc.)
- **Google Places API for enrichment** (place_id, coordinates, hours, phone, address) — not for discovery
- **Chain detection at insert time** via curated list of ~80 known UAE chains + post-insert fuzzy matching for suggestions
- **Three consolidation modes**: `standalone`, `unified_with_branches_parent` (Carrefour-style), `independent_property` (InterContinental-style, each location is its own reviewable entity sharing a brand)
- **Private only** for hospitals and schools — filter out government-operated entities at ingestion
- **Bilingual data** — English + Arabic names where possible
- **9 life moments, 66 categories** (locked taxonomy in section 4)

### Out of scope for Phase 1

- Reviews data (truncating fake test reviews)
- User profiles (truncating fake test profiles)
- AI summaries (feature not yet built)
- Real estate (dropped as a life moment — low review-worthiness)
- Government & utility apps (dropped — regulatory + no user choice)
- Visa, translation, legal, accounting, money exchange (dropped — transactional, not experiential)

---

## 2. Pre-flight checks

**Goal:** verify the environment is ready before any destructive operations.

### Steps

Run each of these and verify the result before proceeding:

**Check 1 — Supabase connection and project**

```sql
SELECT current_database() AS db, current_user AS user_role, version() AS pg_version;
```

Expected: connected to the Reviewencer project's database, role with sufficient privileges (usually `postgres` or `service_role`).

**Check 2 — Confirm the existing tables match what we expect**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected to see (at minimum): `ai_summaries`, `business_cards`, `businesses`, `categories`, `chat_messages`, `feed_reviews`, `legit_votes`, `moderation_events`, `profiles`, `reviews`, `user_tiers`

If any of these are MISSING or there are unexpected extras you weren't told about, **STOP** and report — the database state has diverged from our design notes.

**Check 3 — Confirm row counts match expectations**

```sql
SELECT 'businesses' AS tbl, COUNT(*) FROM businesses
UNION ALL SELECT 'business_cards', COUNT(*) FROM business_cards
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'reviews', COUNT(*) FROM reviews
UNION ALL SELECT 'feed_reviews', COUNT(*) FROM feed_reviews
UNION ALL SELECT 'ai_summaries', COUNT(*) FROM ai_summaries
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'user_tiers', COUNT(*) FROM user_tiers
UNION ALL SELECT 'legit_votes', COUNT(*) FROM legit_votes
UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL SELECT 'moderation_events', COUNT(*) FROM moderation_events
ORDER BY tbl;
```

Expected (approximate, ±10%):
- businesses: ~11,039
- business_cards: ~11,039
- categories: ~20
- reviews: ~83
- feed_reviews: ~83
- ai_summaries: ~17
- profiles: ~5
- user_tiers: ~5
- legit_votes: 0
- chat_messages: 0
- moderation_events: 0

If `reviews` is significantly more than 100, **STOP** — there might be real review data we shouldn't truncate. Verify with Basem before continuing.

**Check 4 — Backup verification**

Confirm a Supabase backup exists from within the last 24 hours.

```
Manual step: ask Basem to confirm via Supabase Dashboard → Database → Backups
that a recent backup (within 24h) exists. If not, instruct Basem to create
one before proceeding.
```

DO NOT proceed past this point without backup confirmation. If unsure, ask.

**Check 5 — Google Cloud setup**

Verify:
- `GOOGLE_PLACES_API_KEY` exists in environment (`.env` file)
- API key is restricted to the new Places API (not legacy)
- Billing budget alert is configured at $200
- Free credit remaining: at least $100

Run this Python snippet to test the key:

```python
import os
import requests

api_key = os.getenv("GOOGLE_PLACES_API_KEY")
assert api_key, "GOOGLE_PLACES_API_KEY missing from environment"

# Test call: Place Details for a known place_id (Burj Khalifa)
url = "https://places.googleapis.com/v1/places/ChIJoRyG2ZdtXz4RICCYZJ4cuRk"
headers = {
    "X-Goog-Api-Key": api_key,
    "X-Goog-FieldMask": "id,displayName,formattedAddress"
}
resp = requests.get(url, headers=headers)
assert resp.status_code == 200, f"API test failed: {resp.status_code} {resp.text}"
print("✓ Google Places API key is working")
print(resp.json())
```

If this returns a 4xx, **STOP** and ask Basem to fix the API key setup.

### Pre-flight stop conditions

- Tables don't exist as expected → STOP
- Row counts wildly different → STOP
- No recent backup → STOP, ask Basem to create one
- Google Places API key not working → STOP, ask Basem to fix

When all checks pass, proceed to Phase A.

---

## 3. Phase A — Database setup

**Goal:** rename existing business-data tables to `legacy_*`, truncate fake test data, create the new schema with proper FKs and indexes.

### Step A1: Rename existing data tables to legacy

These tables hold the broken/unusable data we're replacing. We rename rather than drop so we can salvage things later if needed (e.g., specific SerpAPI logos we paid for).

```sql
BEGIN;

ALTER TABLE businesses RENAME TO legacy_businesses;
ALTER TABLE business_cards RENAME TO legacy_business_cards;
ALTER TABLE categories RENAME TO legacy_categories;

COMMIT;
```

### Step A2: Truncate fake test data

Reviews, profiles, AI summaries, tiers — all fake testing data per Basem's confirmation. Truncate but do not drop the tables themselves (we'll recreate them with new FKs to the new businesses table).

```sql
BEGIN;

TRUNCATE TABLE reviews CASCADE;
TRUNCATE TABLE feed_reviews CASCADE;
TRUNCATE TABLE ai_summaries CASCADE;
TRUNCATE TABLE legit_votes CASCADE;
TRUNCATE TABLE chat_messages CASCADE;
TRUNCATE TABLE moderation_events CASCADE;
TRUNCATE TABLE user_tiers CASCADE;
TRUNCATE TABLE profiles CASCADE;

COMMIT;
```

### Step A3: Drop foreign keys to old businesses (if they exist)

The `reviews`, `feed_reviews`, `business_cards`, etc. tables may have FK constraints pointing to the old `businesses` table (now `legacy_businesses`). We need to drop those before creating new ones.

```sql
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT tc.constraint_name, tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu 
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND ccu.table_name = 'legacy_businesses'
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
                       constraint_record.table_name, constraint_record.constraint_name);
        RAISE NOTICE 'Dropped FK % from %', constraint_record.constraint_name, constraint_record.table_name;
    END LOOP;
END $$;
```

### Step A4: Create new tables

```sql
BEGIN;

-- Emirates: top-level geographic container
CREATE TABLE IF NOT EXISTS emirates (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code         text UNIQUE NOT NULL,  -- 'DXB', 'AUH', 'SHJ'
    slug         text UNIQUE NOT NULL,
    name_en      text NOT NULL,
    name_ar      text NOT NULL,
    country_code text NOT NULL DEFAULT 'AE',
    sort_order   integer NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Areas: sub-regions within emirates
CREATE TABLE IF NOT EXISTS areas (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    emirate_id   uuid NOT NULL REFERENCES emirates(id) ON DELETE RESTRICT,
    slug         text NOT NULL,
    name_en      text NOT NULL,
    name_ar      text,
    lat          numeric(10, 7),
    lng          numeric(10, 7),
    sort_order   integer NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (emirate_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_areas_emirate ON areas(emirate_id);

-- Life moments: top-level category buckets (9 total)
CREATE TABLE IF NOT EXISTS life_moments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug         text UNIQUE NOT NULL,
    name_en      text NOT NULL,
    name_ar      text NOT NULL,
    icon_token   text NOT NULL,         -- Tabler icon name, e.g. 'tools-kitchen-2'
    color_token  text NOT NULL,         -- semantic color token from design system
    sort_order   integer NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Categories: 66 total, each belonging to one life moment
CREATE TABLE IF NOT EXISTS categories (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    life_moment_id  uuid NOT NULL REFERENCES life_moments(id) ON DELETE RESTRICT,
    slug            text UNIQUE NOT NULL,
    name_en         text NOT NULL,
    name_ar         text NOT NULL,
    icon_token      text NOT NULL,
    sort_order      integer NOT NULL DEFAULT 0,
    description     text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_life_moment ON categories(life_moment_id);

-- Brands: for grouping independent_property businesses 
--   (InterContinental Dubai + Abu Dhabi share a brand row, but each is its own reviewable business)
CREATE TABLE IF NOT EXISTS brands (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                  text UNIQUE NOT NULL,
    name_en               text NOT NULL,
    name_ar               text,
    logo_url              text,
    website               text,
    description           text,
    primary_category_id   uuid REFERENCES categories(id) ON DELETE SET NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Consolidation mode enum
DO $$ BEGIN
    CREATE TYPE consolidation_mode_enum AS ENUM (
        'standalone',
        'unified_brand_only',
        'unified_with_branches_parent',
        'independent_property'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Businesses: the reviewable entity. 
--   For 'unified_with_branches_parent': location fields are NULL (only branches have location)
--   For 'standalone' / 'unified_brand_only' / 'independent_property': all location fields populated
CREATE TABLE IF NOT EXISTS businesses (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                     text UNIQUE NOT NULL,
    name_en                  text NOT NULL,
    name_ar                  text,
    category_id              uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand_id                 uuid REFERENCES brands(id) ON DELETE SET NULL,
    consolidation_mode       consolidation_mode_enum NOT NULL DEFAULT 'standalone',
    description              text,
    tagline                  text,
    logo_url                 text,
    cover_image_url          text,
    
    -- Location (NULL for unified_with_branches_parent rows)
    emirate_id               uuid REFERENCES emirates(id) ON DELETE SET NULL,
    area_id                  uuid REFERENCES areas(id) ON DELETE SET NULL,
    address                  text,
    lat                      numeric(10, 7),
    lng                      numeric(10, 7),
    
    -- Contact (NULL for parent rows)
    phone                    text,
    website                  text,
    email                    text,
    instagram_handle         text,
    whatsapp_number          text,
    
    -- Hours: JSON like {"mon": [{"open": "08:00", "close": "00:00"}], ...}
    hours_json               jsonb,
    
    -- External references
    google_place_id          text UNIQUE,
    
    -- Status
    verified                 boolean NOT NULL DEFAULT false,
    claimed_by_user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    source                   text,         -- 'time_out', 'khda', 'manual', 'user_added', etc.
    
    -- Timestamps
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    last_synced_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category_id);
CREATE INDEX IF NOT EXISTS idx_businesses_emirate ON businesses(emirate_id);
CREATE INDEX IF NOT EXISTS idx_businesses_area ON businesses(area_id);
CREATE INDEX IF NOT EXISTS idx_businesses_brand ON businesses(brand_id);
CREATE INDEX IF NOT EXISTS idx_businesses_mode ON businesses(consolidation_mode);
CREATE INDEX IF NOT EXISTS idx_businesses_name ON businesses USING gin (to_tsvector('english', name_en));

-- Business branches: for unified_with_branches_parent businesses, the actual physical locations
CREATE TABLE IF NOT EXISTS business_branches (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id              uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    slug                     text NOT NULL,
    name_en                  text NOT NULL,    -- usually "Brand Name | Mall Name" or "Brand Name | Area"
    name_ar                  text,
    
    -- Location
    emirate_id               uuid NOT NULL REFERENCES emirates(id) ON DELETE RESTRICT,
    area_id                  uuid REFERENCES areas(id) ON DELETE SET NULL,
    address                  text NOT NULL,
    lat                      numeric(10, 7),
    lng                      numeric(10, 7),
    
    -- Contact
    phone                    text,
    hours_json               jsonb,
    
    -- External
    google_place_id          text UNIQUE,
    
    -- Status
    verified                 boolean NOT NULL DEFAULT false,
    
    -- Timestamps
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    last_synced_at           timestamptz,
    
    UNIQUE (business_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_branches_business ON business_branches(business_id);
CREATE INDEX IF NOT EXISTS idx_branches_emirate ON business_branches(emirate_id);
CREATE INDEX IF NOT EXISTS idx_branches_area ON business_branches(area_id);

-- Re-add FKs from existing tables (reviews etc.) pointing to new businesses
-- (reviews table was truncated in Step A2, so safe to add FKs now)

ALTER TABLE reviews 
    ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES business_branches(id) ON DELETE SET NULL;

-- Note: This assumes reviews already has business_id column from before. If it doesn't,
-- add it: ALTER TABLE reviews ADD COLUMN business_id uuid NOT NULL REFERENCES businesses(id);
-- Same logic for feed_reviews, business_cards if they reference businesses.

-- Check and add FK constraints for reviews -> businesses
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reviews' 
          AND column_name = 'business_id' 
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE reviews 
            DROP CONSTRAINT IF EXISTS reviews_business_id_fkey,
            ADD CONSTRAINT reviews_business_id_fkey 
                FOREIGN KEY (business_id) 
                REFERENCES businesses(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_reviews_branch ON reviews(branch_id);

COMMIT;
```

### Step A5: Set up updated_at triggers

```sql
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
DECLARE 
    tbl text;
BEGIN
    FOR tbl IN VALUES ('brands'), ('businesses'), ('business_branches')
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS set_updated_at ON %I;
            CREATE TRIGGER set_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION trigger_set_updated_at();
        ', tbl, tbl);
    END LOOP;
END $$;
```

### Step A6: RLS placeholder policies

Enable Row Level Security with permissive read policies for now. We'll tighten in Phase 2 when authenticated user features are wired up.

```sql
ALTER TABLE emirates ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_branches ENABLE ROW LEVEL SECURITY;

-- Public read for all reference data
DO $$ 
DECLARE 
    tbl text;
BEGIN
    FOR tbl IN VALUES ('emirates'), ('areas'), ('life_moments'), ('categories'), 
                      ('brands'), ('businesses'), ('business_branches')
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS "Public read" ON %I;
            CREATE POLICY "Public read" ON %I
                FOR SELECT
                USING (true);
        ', tbl, tbl);
    END LOOP;
END $$;
```

### Verify Phase A

```sql
-- Check legacy tables exist
SELECT 'legacy renamed' AS check,
       COUNT(*) FILTER (WHERE table_name = 'legacy_businesses') AS legacy_businesses,
       COUNT(*) FILTER (WHERE table_name = 'legacy_business_cards') AS legacy_business_cards,
       COUNT(*) FILTER (WHERE table_name = 'legacy_categories') AS legacy_categories
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Expected: all three = 1

-- Check new tables exist
SELECT 'new tables' AS check,
       COUNT(*) FILTER (WHERE table_name = 'emirates') AS emirates,
       COUNT(*) FILTER (WHERE table_name = 'areas') AS areas,
       COUNT(*) FILTER (WHERE table_name = 'life_moments') AS life_moments,
       COUNT(*) FILTER (WHERE table_name = 'categories') AS categories,
       COUNT(*) FILTER (WHERE table_name = 'brands') AS brands,
       COUNT(*) FILTER (WHERE table_name = 'businesses') AS businesses,
       COUNT(*) FILTER (WHERE table_name = 'business_branches') AS business_branches
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Expected: all seven = 1

-- Check tables are empty
SELECT 'emirates' AS tbl, COUNT(*) FROM emirates
UNION ALL SELECT 'areas', COUNT(*) FROM areas
UNION ALL SELECT 'life_moments', COUNT(*) FROM life_moments
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'brands', COUNT(*) FROM brands
UNION ALL SELECT 'businesses', COUNT(*) FROM businesses
UNION ALL SELECT 'business_branches', COUNT(*) FROM business_branches;
-- Expected: all = 0

-- Check test data tables truncated
SELECT 'reviews' AS tbl, COUNT(*) FROM reviews
UNION ALL SELECT 'feed_reviews', COUNT(*) FROM feed_reviews
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles;
-- Expected: all = 0
```

If any check fails, **STOP** and report.

---

## 4. Phase B — Taxonomy seed

**Goal:** populate emirates, areas, life moments, and categories.

### Step B1: Insert emirates

```sql
INSERT INTO emirates (code, slug, name_en, name_ar, sort_order) VALUES
    ('DXB', 'dubai', 'Dubai', 'دبي', 1),
    ('AUH', 'abu-dhabi', 'Abu Dhabi', 'أبو ظبي', 2),
    ('SHJ', 'sharjah', 'Sharjah', 'الشارقة', 3)
ON CONFLICT (slug) DO NOTHING;
```

### Step B2: Insert areas

```sql
-- DUBAI areas
WITH dxb AS (SELECT id FROM emirates WHERE slug = 'dubai')
INSERT INTO areas (emirate_id, slug, name_en, name_ar, lat, lng, sort_order)
SELECT dxb.id, slug, name_en, name_ar, lat, lng, sort_order
FROM dxb, (VALUES
    ('marina',          'Dubai Marina',         'دبي مارينا',           25.0805, 55.1403,  1),
    ('jbr',             'JBR',                  'جي بي آر',             25.0773, 55.1311,  2),
    ('jlt',             'JLT',                  'أبراج بحيرات جميرا',    25.0688, 55.1395,  3),
    ('downtown',        'Downtown Dubai',       'وسط مدينة دبي',         25.1972, 55.2744,  4),
    ('business-bay',    'Business Bay',         'الخليج التجاري',        25.1857, 55.2632,  5),
    ('difc',            'DIFC',                 'مركز دبي المالي',        25.2138, 55.2810,  6),
    ('jumeirah',        'Jumeirah',             'جميرا',                  25.2086, 55.2418,  7),
    ('palm-jumeirah',   'Palm Jumeirah',        'نخلة جميرا',             25.1124, 55.1390,  8),
    ('mirdif',          'Mirdif',               'مردف',                   25.2151, 55.4193,  9),
    ('deira',           'Deira',                'ديرة',                   25.2697, 55.3094, 10),
    ('bur-dubai',       'Bur Dubai',            'بر دبي',                 25.2582, 55.2922, 11),
    ('al-barsha',       'Al Barsha',            'البرشاء',                25.1124, 55.2007, 12),
    ('al-quoz',         'Al Quoz',              'القوز',                  25.1359, 55.2335, 13),
    ('dubai-hills',     'Dubai Hills',          'تلال الإمارات',           25.1063, 55.2510, 14),
    ('motor-city',      'Motor City',           'مدينة السيارات',          25.0444, 55.2407, 15),
    ('arabian-ranches', 'Arabian Ranches',      'المرابع العربية',         25.0530, 55.2700, 16),
    ('jvc',             'JVC',                  'قرية جميرا الدائرية',     25.0552, 55.2096, 17),
    ('damac-hills',     'DAMAC Hills',          'داماك هيلز',             25.0211, 55.2576, 18),
    ('jumeirah-village','Jumeirah Village',     'قرية جميرا',             25.0497, 55.2076, 19),
    ('city-walk',       'City Walk',            'سيتي ووك',                25.2123, 55.2629, 20),
    ('al-wasl',         'Al Wasl',              'الوصل',                  25.2218, 55.2545, 21),
    ('al-safa',         'Al Safa',              'الصفا',                  25.1928, 55.2369, 22),
    ('umm-suqeim',      'Umm Suqeim',           'أم سقيم',                25.1554, 55.2018, 23),
    ('al-furjan',       'Al Furjan',            'الفرجان',                25.0289, 55.1414, 24),
    ('discovery-gardens','Discovery Gardens',   'حدائق ديسكفري',         25.0451, 55.1411, 25),
    ('international-city','International City', 'المدينة العالمية',       25.1612, 55.4108, 26),
    ('silicon-oasis',   'Dubai Silicon Oasis',  'واحة دبي للسيليكون',     25.1276, 55.3895, 27)
) AS v(slug, name_en, name_ar, lat, lng, sort_order)
ON CONFLICT (emirate_id, slug) DO NOTHING;

-- ABU DHABI areas
WITH auh AS (SELECT id FROM emirates WHERE slug = 'abu-dhabi')
INSERT INTO areas (emirate_id, slug, name_en, name_ar, lat, lng, sort_order)
SELECT auh.id, slug, name_en, name_ar, lat, lng, sort_order
FROM auh, (VALUES
    ('corniche',        'Corniche',             'الكورنيش',               24.4664, 54.3526,  1),
    ('saadiyat-island', 'Saadiyat Island',      'جزيرة السعديات',         24.5414, 54.4358,  2),
    ('yas-island',      'Yas Island',           'جزيرة ياس',              24.4848, 54.6048,  3),
    ('reem-island',     'Reem Island',          'جزيرة الريم',            24.4895, 54.4063,  4),
    ('al-raha',         'Al Raha',              'الراحة',                 24.4365, 54.5074,  5),
    ('al-reem',         'Al Reem',              'الريم',                  24.4998, 54.4133,  6),
    ('khalifa-city',    'Khalifa City',         'مدينة خليفة',            24.4163, 54.5807,  7),
    ('al-mushrif',      'Al Mushrif',           'المشرف',                 24.4530, 54.3760,  8),
    ('al-bateen',       'Al Bateen',            'البطين',                 24.4622, 54.3370,  9),
    ('al-manhal',       'Al Manhal',            'المنهل',                 24.4661, 54.3722, 10),
    ('al-zahiyah',      'Al Zahiyah',           'الزاهية',                24.4901, 54.3567, 11),
    ('al-mariah',       'Al Maryah Island',     'جزيرة الماريه',           24.4980, 54.3833, 12),
    ('masdar-city',     'Masdar City',          'مدينة مصدر',             24.4267, 54.6168, 13),
    ('al-ain',          'Al Ain',               'العين',                  24.2075, 55.7447, 14),
    ('mussafah',        'Mussafah',             'مصفح',                   24.3540, 54.5004, 15)
) AS v(slug, name_en, name_ar, lat, lng, sort_order)
ON CONFLICT (emirate_id, slug) DO NOTHING;

-- SHARJAH areas
WITH shj AS (SELECT id FROM emirates WHERE slug = 'sharjah')
INSERT INTO areas (emirate_id, slug, name_en, name_ar, lat, lng, sort_order)
SELECT shj.id, slug, name_en, name_ar, lat, lng, sort_order
FROM shj, (VALUES
    ('al-majaz',        'Al Majaz',             'المجاز',                25.3263, 55.3818, 1),
    ('al-khan',         'Al Khan',              'الخان',                  25.3318, 55.3735, 2),
    ('al-qasba',        'Al Qasba',             'القصباء',                25.3262, 55.3818, 3),
    ('al-nahda',        'Al Nahda',             'النهدة',                 25.3000, 55.3686, 4),
    ('al-taawun',       'Al Taawun',            'التعاون',                25.3349, 55.3742, 5),
    ('al-rolla',        'Al Rolla',             'الرولة',                 25.3568, 55.3895, 6),
    ('al-mamzar',       'Al Mamzar',            'الممزر',                 25.3208, 55.3506, 7),
    ('muweilah',        'Muweilah',             'مويلح',                  25.2937, 55.4793, 8),
    ('al-tay',          'Al Tay',               'الطي',                   25.2715, 55.5189, 9)
) AS v(slug, name_en, name_ar, lat, lng, sort_order)
ON CONFLICT (emirate_id, slug) DO NOTHING;
```

### Step B3: Insert life moments

```sql
INSERT INTO life_moments (slug, name_en, name_ar, icon_token, color_token, sort_order) VALUES
    ('eating-drinking',     'Eating & drinking',  'الأكل والشرب',           'tools-kitchen-2',     'amber',   1),
    ('health-hygiene',      'Health & hygiene',   'الصحة والعناية',          'heartbeat',           'teal',    2),
    ('family-kids',         'Family & kids',      'العائلة والأطفال',        'friends',             'pink',    3),
    ('weekend-leisure',     'Weekend & leisure',  'الويكند والترفيه',        'beach',               'purple',  4),
    ('transport-cars',      'Transport & cars',   'النقل والسيارات',         'car',                 'blue',    5),
    ('finance-services',    'Finance & services', 'المال والخدمات',          'wallet',              'green',   6),
    ('apps-platforms',      'Apps & platforms',   'التطبيقات والمنصات',      'device-mobile',       'neutral', 7),
    ('shopping-home',       'Shopping & home',    'التسوق والمنزل',          'shopping-bag',        'red',     8),
    ('lifecycle-events',    'Lifecycle events',   'مناسبات الحياة',          'confetti',            'gold',    9)
ON CONFLICT (slug) DO NOTHING;
```

### Step B4: Insert categories

```sql
-- Eating & drinking (11)
WITH lm AS (SELECT id FROM life_moments WHERE slug = 'eating-drinking')
INSERT INTO categories (life_moment_id, slug, name_en, name_ar, icon_token, sort_order, description)
SELECT lm.id, slug, name_en, name_ar, icon_token, sort_order, description
FROM lm, (VALUES
    ('restaurants',          'Restaurants',              'المطاعم',                       'soup',                 1, 'Dine-in restaurants of all cuisines'),
    ('cafes',                'Cafés & coffee shops',     'المقاهي',                        'coffee',               2, 'Coffee shops and casual cafés'),
    ('brunch-breakfast',     'Brunch & breakfast',       'فطور وبرنش',                     'mug',                  3, 'Brunch venues and breakfast spots'),
    ('bakeries-patisseries', 'Bakeries & patisseries',   'المخابز والحلويات',               'cake',                 4, 'Bakeries, patisseries, croissants'),
    ('sweets-desserts',      'Sweets & desserts',        'الحلويات',                       'ice-cream',            5, 'Ice cream, chocolatiers, dessert cafés'),
    ('bars-lounges',         'Bars & lounges',           'البارات والصالات',               'glass-cocktail',       6, 'Bars, cocktail lounges, wine bars'),
    ('street-food',          'Food trucks & street food','عربات الطعام',                   'truck',                7, 'Food trucks, kiosks, street food'),
    ('specialty-food',       'Specialty food shops',     'متاجر الأطعمة المتخصصة',          'salt',                 8, 'Cheese, butchers, olive oil, etc.'),
    ('supermarkets',         'Supermarkets & grocery',   'محلات السوبر ماركت',              'shopping-cart',        9, 'Hypermarkets, supermarkets, grocery stores'),
    ('juice-bars',           'Juice bars & smoothies',   'محلات العصائر',                   'glass',               10, 'Fresh juice and smoothie shops'),
    ('caterers',             'Caterers',                 'خدمات تموين',                    'serving',             11, 'Catering services for events and parties')
) AS v(slug, name_en, name_ar, icon_token, sort_order, description)
ON CONFLICT (slug) DO NOTHING;

-- Health & hygiene (10)
WITH lm AS (SELECT id FROM life_moments WHERE slug = 'health-hygiene')
INSERT INTO categories (life_moment_id, slug, name_en, name_ar, icon_token, sort_order, description)
SELECT lm.id, slug, name_en, name_ar, icon_token, sort_order, description
FROM lm, (VALUES
    ('general-clinics',      'General clinics & medical centres', 'العيادات العامة',         'stethoscope',         1, 'General practice and primary care clinics'),
    ('hospitals',            'Hospitals',                'المستشفيات',                      'building-hospital',   2, 'Private hospitals only'),
    ('specialty-clinics',    'Specialty clinics',        'العيادات التخصصية',                'first-aid-kit',       3, 'Dermatology, fertility, ENT, etc.'),
    ('aesthetic-clinics',    'Aesthetic & cosmetic clinics', 'عيادات التجميل',              'sparkles',            4, 'Cosmetic and aesthetic procedures'),
    ('dental',               'Dental & orthodontics',    'طب الأسنان',                      'tooth',               5, 'Dental clinics and orthodontists'),
    ('pharmacies',           'Pharmacies',               'الصيدليات',                       'pill',                6, 'Pharmacies and drug stores'),
    ('opticians',            'Opticians & eye care',     'محلات النظارات',                  'eye',                 7, 'Opticians, optometrists, eye clinics'),
    ('salons-spas',          'Salons, barbers & spas',   'الصالونات والسبا',                'scissors',            8, 'Hair salons, barbers, nail bars, spas'),
    ('wellness',             'Wellness & alternative medicine', 'الصحة البديلة',           'lotus',               9, 'Physio, chiro, acupuncture, ayurveda'),
    ('fitness-nutrition',    'Fitness & nutrition consultants', 'استشاريي اللياقة',        'barbell',            10, 'Personal trainers, dieticians, sports clinics')
) AS v(slug, name_en, name_ar, icon_token, sort_order, description)
ON CONFLICT (slug) DO NOTHING;

-- Family & kids (7)
WITH lm AS (SELECT id FROM life_moments WHERE slug = 'family-kids')
INSERT INTO categories (life_moment_id, slug, name_en, name_ar, icon_token, sort_order, description)
SELECT lm.id, slug, name_en, name_ar, icon_token, sort_order, description
FROM lm, (VALUES
    ('schools',              'Schools',                  'المدارس',                         'school',              1, 'Private schools only'),
    ('nurseries',            'Nurseries & early years',  'الحضانات',                        'baby-bottle',         2, 'Nurseries, early years centres'),
    ('tutoring',             'Tutoring & enrichment academies', 'مراكز التعلم',           'notebook',            3, 'Tutoring, music, art, sports academies for kids'),
    ('family-entertainment', 'Family entertainment & play areas', 'الترفيه العائلي',     'horse-toy',           4, 'Play areas, soft play, kids activity centres'),
    ('kids-shops',           'Toy shops & kids clothing','محلات الأطفال',                  'teddy-bear',          5, 'Toys, kids fashion, kids accessories'),
    ('kids-parties',         'Children parties & birthdays', 'حفلات الأطفال',             'cake',                6, 'Kids party planners and services'),
    ('maternity-baby',       'Maternity & baby care',    'خدمات الأمومة والرضاعة',          'baby-carriage',       7, 'Lactation, doulas, baby gear, mother care')
) AS v(slug, name_en, name_ar, icon_token, sort_order, description)
ON CONFLICT (slug) DO NOTHING;

-- Weekend & leisure (10)
WITH lm AS (SELECT id FROM life_moments WHERE slug = 'weekend-leisure')
INSERT INTO categories (life_moment_id, slug, name_en, name_ar, icon_token, sort_order, description)
SELECT lm.id, slug, name_en, name_ar, icon_token, sort_order, description
FROM lm, (VALUES
    ('beach-clubs',          'Beach clubs & pool clubs', 'نوادي الشاطئ والمسبح',            'beach',               1, 'Beach clubs, pool clubs, day passes'),
    ('cinemas',              'Cinemas & theatres',       'السينما والمسارح',                'movie',               2, 'Cinemas and live theatres'),
    ('theme-parks',          'Theme parks & attractions','الملاهي والمعالم',                'ferris-wheel',        3, 'Theme parks, water parks, attractions'),
    ('sports-fitness',       'Sports & fitness facilities', 'مرافق الرياضة',                'barbell',             4, 'Gyms, padel, climbing, studios'),
    ('outdoor-activities',   'Outdoor activities',       'الأنشطة الخارجية',                'sailboat',            5, 'Desert safaris, sailing, dhow cruises, dune buggies'),
    ('hotels',               'Hotels & resorts',         'الفنادق والمنتجعات',              'building-skyscraper', 6, 'Hotels, resorts, includes wedding/event venues'),
    ('cultural-sites',       'Cultural sites & museums', 'المواقع الثقافية',                'building-monument',   7, 'Museums, galleries, heritage sites'),
    ('nightlife',            'Nightlife & clubs',        'الحياة الليلية',                  'music',               8, 'Nightclubs, late-night venues'),
    ('tours',                'Tour operators & day trips','مشغلي الجولات',                  'compass',             9, 'Tour operators, sightseeing, day trips'),
    ('holiday-homes',        'Holiday homes & short-term rentals', 'الإيجارات قصيرة المدى', 'home-search',        10, 'Holiday homes, short-term rentals')
) AS v(slug, name_en, name_ar, icon_token, sort_order, description)
ON CONFLICT (slug) DO NOTHING;

-- Transport & cars (5)
WITH lm AS (SELECT id FROM life_moments WHERE slug = 'transport-cars')
INSERT INTO categories (life_moment_id, slug, name_en, name_ar, icon_token, sort_order, description)
SELECT lm.id, slug, name_en, name_ar, icon_token, sort_order, description
FROM lm, (VALUES
    ('car-dealers',          'Car dealerships',          'وكلاء السيارات',                  'steering-wheel',      1, 'New and used car dealerships'),
    ('garages',              'Garages & car servicing',  'مراكز خدمة السيارات',             'car-garage',          2, 'Garages, mechanics, includes tyres/batteries/parts'),
    ('car-wash',             'Car wash & detailing',     'غسيل السيارات',                   'spray',               3, 'Car wash and detailing services'),
    ('car-rental',           'Car rentals & leasing',    'تأجير السيارات',                  'key',                 4, 'Short and long-term car rentals'),
    ('driving-schools',      'Driving schools',          'مدارس القيادة',                   'license',             5, 'Driving instruction schools')
) AS v(slug, name_en, name_ar, icon_token, sort_order, description)
ON CONFLICT (slug) DO NOTHING;

-- Finance & services (3)
WITH lm AS (SELECT id FROM life_moments WHERE slug = 'finance-services')
INSERT INTO categories (life_moment_id, slug, name_en, name_ar, icon_token, sort_order, description)
SELECT lm.id, slug, name_en, name_ar, icon_token, sort_order, description
FROM lm, (VALUES
    ('banks',                'Banks',                    'البنوك',                          'building-bank',       1, 'Banks (includes their mobile apps as one experience)'),
    ('insurance',            'Insurance',                'التأمين',                         'shield-check',        2, 'Health, car, life, home insurance'),
    ('telecom',              'Mobile, telecom & internet','الاتصالات والإنترنت',            'antenna',             3, 'du, Etisalat, internet providers')
) AS v(slug, name_en, name_ar, icon_token, sort_order, description)
ON CONFLICT (slug) DO NOTHING;

-- Apps & platforms (2)
WITH lm AS (SELECT id FROM life_moments WHERE slug = 'apps-platforms')
INSERT INTO categories (life_moment_id, slug, name_en, name_ar, icon_token, sort_order, description)
SELECT lm.id, slug, name_en, name_ar, icon_token, sort_order, description
FROM lm, (VALUES
    ('delivery-rideshare',   'Delivery & rideshare apps','تطبيقات التوصيل والمشاركة',       'truck-delivery',      1, 'Talabat, Careem, Noon Food, Uber, Deliveroo'),
    ('marketplaces',         'Online marketplaces',      'الأسواق الإلكترونية',             'shopping-bag',        2, 'Noon, Amazon.ae, SHEIN UAE, Trendyol')
) AS v(slug, name_en, name_ar, icon_token, sort_order, description)
ON CONFLICT (slug) DO NOTHING;

-- Shopping & home (14)
WITH lm AS (SELECT id FROM life_moments WHERE slug = 'shopping-home')
INSERT INTO categories (life_moment_id, slug, name_en, name_ar, icon_token, sort_order, description)
SELECT lm.id, slug, name_en, name_ar, icon_token, sort_order, description
FROM lm, (VALUES
    ('furniture',            'Furniture & home décor',   'الأثاث والديكور',                 'sofa',                1, 'Furniture, home accessories, décor'),
    ('fashion',              'Fashion & clothing',       'الأزياء والملابس',                'hanger',              2, 'Fashion retail, boutiques, clothing'),
    ('jewellery',            'Jewellery & watches',      'المجوهرات والساعات',              'diamond',             3, 'Jewellery and watch retailers'),
    ('electronics',          'Electronics & gadgets',    'الإلكترونيات',                    'device-laptop',       4, 'Phones, computers, electronics retail'),
    ('hardware-diy',         'Hardware & DIY',           'العدد والأدوات',                  'tool',                5, 'ACE Hardware and similar DIY shops'),
    ('appliances',           'Home appliances',          'الأجهزة المنزلية',                'fridge',              6, 'White goods, kitchen appliances'),
    ('bedding-linens',       'Bedding, linens & home textiles', 'المفروشات',              'bed',                 7, 'Bedding, sheets, towels, home textiles'),
    ('kitchenware',          'Kitchenware & cookware',   'أدوات المطبخ',                    'tools-kitchen',       8, 'Pots, pans, kitchen utensils'),
    ('garden',               'Garden & outdoor supplies','مستلزمات الحديقة',                'plant',               9, 'Garden centres, outdoor furniture'),
    ('florists',             'Florists & gift shops',    'محلات الزهور والهدايا',           'flower',             10, 'Flower shops, gift shops'),
    ('photography',          'Photography & videography services', 'خدمات التصوير',     'camera',             11, 'Wedding, family, maternity, corporate photography'),
    ('tailors',              'Tailors & alterations',    'خياطين',                         'needle',             12, 'Bespoke tailors and alteration services'),
    ('home-services',        'Cleaning, maintenance & moving', 'خدمات منزلية',           'broom',              13, 'Cleaning, AC repair, plumbing, electrical, moving'),
    ('pets',                 'Pets',                     'الحيوانات الأليفة',               'paw',                14, 'Vets, grooming, pet shops, supplies')
) AS v(slug, name_en, name_ar, icon_token, sort_order, description)
ON CONFLICT (slug) DO NOTHING;

-- Lifecycle events (3)
WITH lm AS (SELECT id FROM life_moments WHERE slug = 'lifecycle-events')
INSERT INTO categories (life_moment_id, slug, name_en, name_ar, icon_token, sort_order, description)
SELECT lm.id, slug, name_en, name_ar, icon_token, sort_order, description
FROM lm, (VALUES
    ('wedding-venues',       'Wedding venues & planners','أماكن الأعراس ومنظميها',          'rings-wedding',       1, 'Wedding venues, planners, coordinators'),
    ('event-venues',         'Event venues & meeting rooms','أماكن المناسبات',             'calendar-event',      2, 'Event halls, meeting rooms, conference venues'),
    ('event-catering',       'Catering & event entertainment', 'تموين وترفيه المناسبات', 'confetti',            3, 'Catering for events, DJs, MCs, entertainment')
) AS v(slug, name_en, name_ar, icon_token, sort_order, description)
ON CONFLICT (slug) DO NOTHING;
```

### Verify Phase B

```sql
-- Count check
SELECT 'emirates' AS tbl, COUNT(*) AS n FROM emirates
UNION ALL SELECT 'areas', COUNT(*) FROM areas
UNION ALL SELECT 'life_moments', COUNT(*) FROM life_moments
UNION ALL SELECT 'categories', COUNT(*) FROM categories
ORDER BY tbl;

-- Expected:
-- emirates: 3
-- areas: 51 (27 Dubai + 15 Abu Dhabi + 9 Sharjah)
-- life_moments: 9
-- categories: 66

-- Category distribution check
SELECT lm.slug AS life_moment, COUNT(c.id) AS n_categories
FROM life_moments lm
LEFT JOIN categories c ON c.life_moment_id = lm.id
GROUP BY lm.slug, lm.sort_order
ORDER BY lm.sort_order;

-- Expected:
-- eating-drinking: 11
-- health-hygiene: 10
-- family-kids: 7
-- weekend-leisure: 10
-- transport-cars: 5
-- finance-services: 3
-- apps-platforms: 2
-- shopping-home: 14
-- lifecycle-events: 3
-- TOTAL: 65 ← (Note: this is 65, not 66, because I made arithmetic errors during design. 
--              See section 4 for the source-of-truth category list. Recount and reconcile 
--              before reporting back to Basem.)
```

**STOP at end of Phase B.** Report count results to Basem. Especially verify the category count discrepancy noted above — if categories = 65 instead of 66, identify which life moment is short by one and reconcile with Basem before proceeding.

---

## 5. Phase C — Time Out scraping

**Goal:** scrape Time Out Dubai, Abu Dhabi, and Sharjah to produce a curated list of businesses across our 65 categories. Output: a CSV for Basem to review before any Google Places enrichment runs.

### Key sources

| Source | URL base | Coverage |
|---|---|---|
| Time Out Dubai | `https://www.timeoutdubai.com` | All categories, deepest coverage |
| Time Out Abu Dhabi | `https://www.timeoutabudhabi.com` | All categories, second-deepest |
| Time Out Sharjah | `https://www.timeoutsharjah.com` | Lighter coverage, focused on food/leisure |

### Approach

For each Time Out site, the script should:

1. **Crawl listicle pages** — articles titled "Best X in Y" (e.g., "Best Lebanese restaurants in Dubai", "Top 10 brunches in Abu Dhabi", "Best salons in Sharjah"). Time Out organizes content into:
   - `/restaurants` — restaurant section
   - `/things-to-do` — leisure activities
   - `/family` — family content
   - `/nightlife` — bars and clubs
   - `/hotels` — hotels and resorts
   - `/shopping` — retail
   - `/wellness` — spas, salons, fitness
   
2. **Extract from each listicle**:
   - The article title (gives us category and emirate)
   - Business names mentioned (typically in `<h2>` or `<h3>` headers within the article)
   - Optional: brief description, photo URL, link to official site
   
3. **Map article topic → our categories**:
   - "Best Lebanese restaurants" → `restaurants` category
   - "Best brunches" → `brunch-breakfast`
   - "Best salons" → `salons-spas`
   - Define a YAML mapping table: topic_keyword → our_category_slug
   - For each article processed, log the mapping decision for Basem to review

4. **Output a CSV** with columns:
   - `source` (e.g., `time_out_dubai`)
   - `source_url` (the article URL the business came from)
   - `name` (business name as extracted)
   - `category_guess` (our category slug, derived from article topic)
   - `emirate_slug` (from the site domain)
   - `area_guess` (extracted from article body if mentioned, otherwise null)
   - `notes` (any context from the article, e.g., "Lebanese cuisine, Marina")
   - `extracted_at` (timestamp)

### Implementation notes

- **Use Python with `requests` and `beautifulsoup4`** for the scraping
- **Respect robots.txt** — check each Time Out site's robots.txt and honor crawl-delay
- **Rate limit** to 1 request per 2 seconds per domain — we're not in a hurry, this is one-time research
- **User-Agent** should be honest: `Reviewencer Research Bot (basem@reviewencer.ae) — Curating UAE business listings for editorial review`
- **Skip if 4xx/5xx errors** — log and move on
- **Resume capability** — write to CSV incrementally, save progress; if interrupted, can resume from last completed article
- **Output file**: `/scrapers/output/time_out_raw.csv`

### Categories the script should focus on (Time Out coverage strongest here)

These are the categories where Time Out gives us the best curation:

- restaurants, cafes, brunch-breakfast, bakeries-patisseries, sweets-desserts, bars-lounges, juice-bars
- salons-spas, wellness, fitness-nutrition
- family-entertainment
- beach-clubs, cinemas, theme-parks, sports-fitness, outdoor-activities, hotels, cultural-sites, nightlife, tours
- furniture, fashion, jewellery, florists

Skip via Time Out (use other sources in Phase D):
- schools (KHDA)
- clinics, hospitals, dental, opticians, specialty-clinics, aesthetic-clinics (DHA/DOH/SHA)
- nurseries (KHDA)
- banks (UAE Banks Federation)
- driving-schools (RTA)

### Expected volume

- Time Out Dubai: ~800-1,500 unique business mentions across categories
- Time Out Abu Dhabi: ~400-800
- Time Out Sharjah: ~150-300
- **Total: ~1,500-2,500 unique businesses after dedup**

### Stop conditions

- Site rate limits you (429 responses) → pause, reduce rate, resume
- Significant structural change to site (selectors break) → STOP, report to Basem with screenshot of broken page
- CSV file size exceeds 10MB → unusual, STOP and investigate

When scraping is complete, **STOP and produce a summary** for Basem:
- Total articles processed
- Total business mentions extracted
- Top 5 categories by mention count
- Sample of 20 extracted rows for sanity check
- Path to the CSV file

Do not proceed to Phase D until Basem confirms the scrape looks reasonable.

---

## 6. Phase D — Additional sources

**Goal:** supplement Time Out with regulator and official directories for categories Time Out doesn't cover well.

For each source below, the script should produce its own CSV in `/scrapers/output/` named after the source, with the same column structure as Phase C.

### D1. KHDA — Dubai private schools and nurseries

- URL: `https://www.khda.gov.ae/en/`  
- Look for the directory of inspected private schools (has ratings: Outstanding/Very Good/Good/Acceptable/Weak/Unsatisfactory)
- Extract: school name, type (school/nursery), area, KHDA rating, official website
- Categories: `schools`, `nurseries`
- Expected: ~700 private schools + ~300 nurseries

### D2. ADEK — Abu Dhabi private schools

- URL: `https://www.adek.gov.ae/en/`
- Find the licensed schools list
- Same field extraction as KHDA
- Expected: ~200 schools

### D3. SPEA — Sharjah private schools

- URL: `https://spea.shj.ae/`
- Same approach
- Expected: ~80 schools

### D4. DHA — Dubai Health Authority licensed facilities

- URL: `https://www.dha.gov.ae/en/Pages/default.aspx`
- Find "Sheryan" licensing portal or facilities directory
- Filter for: clinics, hospitals (private), dental, opticians, pharmacies
- Categories: `general-clinics`, `hospitals`, `specialty-clinics`, `aesthetic-clinics`, `dental`, `opticians`, `pharmacies`
- Expected: ~3,000-4,000 facilities

### D5. DOH — Abu Dhabi Department of Health

- URL: `https://www.doh.gov.ae/`
- Find licensed health facilities directory
- Same categories as DHA
- Expected: ~1,500-2,000

### D6. SHA — Sharjah Health Authority  

- URL: `https://sha.gov.ae/`
- Same approach
- Expected: ~600

### D7. RTA — Dubai driving schools

- URL: `https://www.rta.ae/`
- Find list of approved driving schools/training centres
- Category: `driving-schools`
- Expected: ~30-50

### D8. UAE Banks Federation

- URL: `https://uaebf.ae/en/members/`
- Extract member bank list
- Category: `banks`
- Expected: ~50 banks

### D9. Mall directories (optional, time-permitting)

For top malls — Mall of the Emirates, Dubai Mall, City Centre Mirdif, Yas Mall, Abu Dhabi Mall, City Centre Sharjah, etc.:

- Extract tenant/store directories
- Use category mapping (their "Fashion" → our `fashion`, etc.)
- Useful for: `fashion`, `jewellery`, `electronics`, `furniture`, `cafes`, `restaurants`
- Expected: ~500-1,500 tenant mentions

### Stop conditions per source

- Government source requires login or API key Basem hasn't set up → STOP that source, continue with others, note in report
- Source structure too messy to parse reliably → STOP that source, note for manual fallback

### Combined output

After all sources complete, produce `/scrapers/output/curated_combined.csv` — merging all source CSVs into one. Same columns. This is what gets reviewed in Phase E.

---

## 7. Phase E — Manual review checkpoint

**Goal:** Basem reviews `curated_combined.csv` and approves it before any Google Places API calls are made.

### Steps

1. **Deduplicate** the combined CSV by `(name, emirate_slug)`:
   - If "Operation Falafel" appears in 5 Time Out articles, keep one row
   - Merge `source` columns: `time_out_dubai|time_out_abu_dhabi`
   - Merge `source_url` columns into a list
   - Pick the most-mentioned `category_guess` as canonical
   
2. **Output a deduplicated CSV**: `/scrapers/output/curated_deduplicated.csv`

3. **Produce a review summary** for Basem:
   - Total unique businesses
   - Distribution by category (count per category slug)
   - Distribution by emirate
   - Sample of 50 rows for spot-check
   - Likely chain candidates (names appearing across multiple sources or with similar prefixes — Carrefour, Operation Falafel, Starbucks, etc.)

4. **HALT execution and wait for Basem.**

   Print clearly:
   > **EXECUTION PAUSED FOR MANUAL REVIEW**  
   > Please review `/scrapers/output/curated_deduplicated.csv` and either:  
   > (a) approve it as-is by replying "approved"  
   > (b) edit the CSV directly (delete rows, fix categories, add missing businesses) and reply "approved with edits"  
   > (c) reject and explain what needs to change

5. **Do not proceed** until Basem confirms.

---

## 8. Phase F — Google Places enrichment

**Goal:** for each row in the approved CSV, fetch canonical business data via Google Places API and insert into the new schema.

### Pre-flight for this phase

```python
# Confirm CSV exists and is approved
assert os.path.exists("/scrapers/output/curated_deduplicated.csv")
assert os.path.exists("/scrapers/output/APPROVED.flag")  # Basem creates this file

# Confirm API budget remains
# (Check via Google Cloud Console — Basem reports remaining balance)
```

### Curated chain list

For chain detection, use this initial list of UAE chains. When a business name matches one of these (after normalization), treat it as a chain branch and consolidate under the parent.

```python
UAE_KNOWN_CHAINS = {
    # F&B chains
    "Carrefour": {"category": "supermarkets", "mode": "unified_with_branches_parent"},
    "Lulu": {"category": "supermarkets", "mode": "unified_with_branches_parent"},
    "Spinneys": {"category": "supermarkets", "mode": "unified_with_branches_parent"},
    "Choithrams": {"category": "supermarkets", "mode": "unified_with_branches_parent"},
    "Union Coop": {"category": "supermarkets", "mode": "unified_with_branches_parent"},
    "Geant": {"category": "supermarkets", "mode": "unified_with_branches_parent"},
    "Aswaaq": {"category": "supermarkets", "mode": "unified_with_branches_parent"},
    "Operation Falafel": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Allo Beirut": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Zaroob": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Tim Hortons": {"category": "cafes", "mode": "unified_with_branches_parent"},
    "Starbucks": {"category": "cafes", "mode": "unified_with_branches_parent"},
    "Costa": {"category": "cafes", "mode": "unified_with_branches_parent"},
    "Costa Coffee": {"category": "cafes", "mode": "unified_with_branches_parent"},
    "% Arabica": {"category": "cafes", "mode": "unified_with_branches_parent"},
    "Joe & The Juice": {"category": "juice-bars", "mode": "unified_with_branches_parent"},
    "Pret": {"category": "cafes", "mode": "unified_with_branches_parent"},
    "Pret A Manger": {"category": "cafes", "mode": "unified_with_branches_parent"},
    "Le Pain Quotidien": {"category": "bakeries-patisseries", "mode": "unified_with_branches_parent"},
    "Paul": {"category": "bakeries-patisseries", "mode": "unified_with_branches_parent"},
    "Eric Kayser": {"category": "bakeries-patisseries", "mode": "unified_with_branches_parent"},
    "Shake Shack": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Five Guys": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "McDonald's": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "KFC": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Burger King": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Pizza Hut": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Domino's": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Subway": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Hardee's": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Texas Chicken": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Popeyes": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Papa John's": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Wagamama": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "P.F. Chang's": {"category": "restaurants", "mode": "unified_with_branches_parent"},
    "Pinkberry": {"category": "sweets-desserts", "mode": "unified_with_branches_parent"},
    "Cinnabon": {"category": "sweets-desserts", "mode": "unified_with_branches_parent"},
    "Krispy Kreme": {"category": "bakeries-patisseries", "mode": "unified_with_branches_parent"},
    "Baskin Robbins": {"category": "sweets-desserts", "mode": "unified_with_branches_parent"},
    "Magnum": {"category": "sweets-desserts", "mode": "unified_with_branches_parent"},
    "Ben & Jerry's": {"category": "sweets-desserts", "mode": "unified_with_branches_parent"},
    "Coldstone": {"category": "sweets-desserts", "mode": "unified_with_branches_parent"},
    "Patchi": {"category": "sweets-desserts", "mode": "unified_with_branches_parent"},
    "Bateel": {"category": "sweets-desserts", "mode": "unified_with_branches_parent"},

    # Retail chains
    "IKEA": {"category": "furniture", "mode": "unified_with_branches_parent"},
    "Home Centre": {"category": "furniture", "mode": "unified_with_branches_parent"},
    "West Elm": {"category": "furniture", "mode": "unified_with_branches_parent"},
    "Pottery Barn": {"category": "furniture", "mode": "unified_with_branches_parent"},
    "Crate & Barrel": {"category": "furniture", "mode": "unified_with_branches_parent"},
    "Sharaf DG": {"category": "electronics", "mode": "unified_with_branches_parent"},
    "Jumbo Electronics": {"category": "electronics", "mode": "unified_with_branches_parent"},
    "Plug-Ins": {"category": "electronics", "mode": "unified_with_branches_parent"},
    "eXtra": {"category": "electronics", "mode": "unified_with_branches_parent"},
    "H&M": {"category": "fashion", "mode": "unified_with_branches_parent"},
    "Zara": {"category": "fashion", "mode": "unified_with_branches_parent"},
    "Mango": {"category": "fashion", "mode": "unified_with_branches_parent"},
    "Centrepoint": {"category": "fashion", "mode": "unified_with_branches_parent"},
    "Splash": {"category": "fashion", "mode": "unified_with_branches_parent"},
    "Lifestyle": {"category": "fashion", "mode": "unified_with_branches_parent"},
    "Max Fashion": {"category": "fashion", "mode": "unified_with_branches_parent"},
    "Daiso": {"category": "kids-shops", "mode": "unified_with_branches_parent"},
    "Miniso": {"category": "kids-shops", "mode": "unified_with_branches_parent"},
    "Damas": {"category": "jewellery", "mode": "unified_with_branches_parent"},
    "Joyalukkas": {"category": "jewellery", "mode": "unified_with_branches_parent"},
    "Malabar Gold": {"category": "jewellery", "mode": "unified_with_branches_parent"},
    "ACE Hardware": {"category": "hardware-diy", "mode": "unified_with_branches_parent"},
    
    # Health & beauty chains
    "Boots": {"category": "pharmacies", "mode": "unified_with_branches_parent"},
    "Boots Pharmacy": {"category": "pharmacies", "mode": "unified_with_branches_parent"},
    "Aster Pharmacy": {"category": "pharmacies", "mode": "unified_with_branches_parent"},
    "Life Pharmacy": {"category": "pharmacies", "mode": "unified_with_branches_parent"},
    "BinSina Pharmacy": {"category": "pharmacies", "mode": "unified_with_branches_parent"},
    "Aster Clinic": {"category": "general-clinics", "mode": "unified_with_branches_parent"},
    
    # Hotels (independent_property — each location is its own reviewable entity)
    "InterContinental": {"category": "hotels", "mode": "independent_property"},
    "Hilton": {"category": "hotels", "mode": "independent_property"},
    "Marriott": {"category": "hotels", "mode": "independent_property"},
    "Hyatt": {"category": "hotels", "mode": "independent_property"},
    "Sheraton": {"category": "hotels", "mode": "independent_property"},
    "Four Seasons": {"category": "hotels", "mode": "independent_property"},
    "Ritz-Carlton": {"category": "hotels", "mode": "independent_property"},
    "Address Hotels": {"category": "hotels", "mode": "independent_property"},
    "Rotana": {"category": "hotels", "mode": "independent_property"},
    "Jumeirah": {"category": "hotels", "mode": "independent_property"},
    
    # Hospitals (independent_property)
    "Mediclinic": {"category": "hospitals", "mode": "independent_property"},
    "NMC": {"category": "hospitals", "mode": "independent_property"},
    "American Hospital": {"category": "hospitals", "mode": "independent_property"},
    "Medeor": {"category": "hospitals", "mode": "independent_property"},
    
    # Banks (unified_brand_only — each "bank" is one entity, not many branches)
    "Emirates NBD": {"category": "banks", "mode": "unified_brand_only"},
    "ADCB": {"category": "banks", "mode": "unified_brand_only"},
    "FAB": {"category": "banks", "mode": "unified_brand_only"},
    "First Abu Dhabi Bank": {"category": "banks", "mode": "unified_brand_only"},
    "Mashreq": {"category": "banks", "mode": "unified_brand_only"},
    "RAKBank": {"category": "banks", "mode": "unified_brand_only"},
    "Dubai Islamic Bank": {"category": "banks", "mode": "unified_brand_only"},
    "Liv.": {"category": "banks", "mode": "unified_brand_only"},
    
    # Apps & platforms (unified_brand_only — they are the platform)
    "Talabat": {"category": "delivery-rideshare", "mode": "unified_brand_only"},
    "Careem": {"category": "delivery-rideshare", "mode": "unified_brand_only"},
    "Noon Food": {"category": "delivery-rideshare", "mode": "unified_brand_only"},
    "Deliveroo": {"category": "delivery-rideshare", "mode": "unified_brand_only"},
    "Uber": {"category": "delivery-rideshare", "mode": "unified_brand_only"},
    "Noon": {"category": "marketplaces", "mode": "unified_brand_only"},
    "Amazon.ae": {"category": "marketplaces", "mode": "unified_brand_only"},
    "SHEIN": {"category": "marketplaces", "mode": "unified_brand_only"},
    "Dubizzle": {"category": "marketplaces", "mode": "unified_brand_only"},
    
    # Telecom (unified_brand_only — one brand, one experience)
    "du": {"category": "telecom", "mode": "unified_brand_only"},
    "Etisalat": {"category": "telecom", "mode": "unified_brand_only"},
    "e&": {"category": "telecom", "mode": "unified_brand_only"},
    
    # Attractions (typically standalone)
    "Atlantis": {"category": "theme-parks", "mode": "independent_property"},
    "Ski Dubai": {"category": "theme-parks", "mode": "standalone"},
    "IMG Worlds": {"category": "theme-parks", "mode": "standalone"},
    "Global Village": {"category": "theme-parks", "mode": "standalone"},
    "Wild Wadi": {"category": "theme-parks", "mode": "standalone"},
    "Aquaventure": {"category": "theme-parks", "mode": "standalone"},
}
```

### Per-row processing

For each row in `curated_deduplicated.csv`:

1. **Normalize the name** — strip common suffixes ("LLC", "DMCC", "FZE"), trim whitespace, lowercase for comparison
2. **Check curated chain list** — does the normalized name match (or start with) a known chain prefix?
3. **If chain match**:
   - Get or create the `brands` row for this chain
   - Get or create the `businesses` parent row with `consolidation_mode = chain.mode`, location fields NULL if `unified_with_branches_parent`
   - Call Google Places to find this specific branch location
   - Insert into `business_branches` (or for `independent_property`, into `businesses` with `brand_id` set)
4. **If not chain**:
   - Set `consolidation_mode = 'standalone'`
   - Call Google Places once for the business
   - Insert into `businesses` with all location fields populated

### Google Places call pattern

For each business (chain branch or standalone), do:

**Step 1: Text Search to find the place_id**

```python
import requests

def find_place_id(name: str, emirate_slug: str, area_slug: str = None):
    """Returns the most likely place_id for a business name in the given location."""
    
    emirate_name_map = {
        "dubai": "Dubai, UAE",
        "abu-dhabi": "Abu Dhabi, UAE", 
        "sharjah": "Sharjah, UAE"
    }
    
    query_parts = [name]
    if area_slug:
        query_parts.append(area_slug.replace("-", " ").title())
    query_parts.append(emirate_name_map[emirate_slug])
    query = " ".join(query_parts)
    
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location"
    }
    body = {
        "textQuery": query,
        "regionCode": "AE",
        "maxResultCount": 5
    }
    
    resp = requests.post(url, headers=headers, json=body)
    if resp.status_code != 200:
        return None, f"Search failed: {resp.status_code}"
    
    results = resp.json().get("places", [])
    if not results:
        return None, "No results found"
    
    # Return top result's place_id, plus all candidates for review
    return results[0]["id"], results
```

**Step 2: Place Details for the chosen place_id**

```python
def get_place_details(place_id: str):
    """Returns full details for a place."""
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    headers = {
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": (
            "id,displayName,formattedAddress,location,types,"
            "internationalPhoneNumber,websiteUri,regularOpeningHours,"
            "businessStatus"
        )
    }
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        return None
    return resp.json()
```

### Hours JSON conversion

Convert Google's `regularOpeningHours` to our `hours_json` format:

```python
def google_hours_to_json(google_hours):
    """Convert Google's opening hours format to our hours_json."""
    day_map = {
        "MONDAY": "mon", "TUESDAY": "tue", "WEDNESDAY": "wed",
        "THURSDAY": "thu", "FRIDAY": "fri", "SATURDAY": "sat", "SUNDAY": "sun"
    }
    result = {day: [] for day in day_map.values()}
    
    for period in google_hours.get("periods", []):
        open_day = day_map.get(period.get("open", {}).get("day", "").upper())
        if not open_day:
            continue
        result[open_day].append({
            "open": f"{period['open']['hour']:02d}:{period['open']['minute']:02d}",
            "close": f"{period['close']['hour']:02d}:{period['close']['minute']:02d}"
        })
    
    return result
```

### Resume capability

The script must be resumable. Track progress:

```python
# Write a progress file after each row processed
{
    "last_processed_row": 247,
    "successes": 245,
    "failures": 2,
    "api_calls_made": 494,  # 2 per business (text search + details)
    "started_at": "2026-01-15T10:00:00Z"
}
```

On startup, check if progress file exists. If yes, resume from `last_processed_row + 1`.

### Per-row output

After processing each row, log to a per-business CSV report:

```
row_id, source_name, google_place_id, status, business_id_inserted, branch_id_inserted, notes
1, "Operation Falafel", "ChIJxxx", "ok", "<uuid>", "<uuid>", "matched chain, created branch"
2, "Tom & Serg", "ChIJyyy", "ok", "<uuid>", null, "standalone created"
3, "Some Closed Place", null, "skipped", null, null, "Google says permanently closed"
4, "Ambiguous Name", "ChIJzzz", "review_needed", "<uuid>", null, "low confidence match, flagged for manual review"
```

### Stop conditions

- Budget exhausted (check Google Cloud Console) → STOP, ask Basem to top up
- More than 10% of rows fail with same error pattern → STOP, debug
- API returns 4xx persistently → STOP, check API key restrictions
- Database insert fails with constraint violation → STOP, inspect schema vs. inserted data

### Reporting

After Phase F completes, produce a summary:

```
PHASE F COMPLETE

Input:           2,341 rows in approved CSV
Processed:       2,341
Successful:      2,189
Skipped (closed): 87
Review needed:   34
Failed:          31

Output:
  brands created: 47
  businesses (standalone): 1,498
  businesses (unified_with_branches_parent): 32
  businesses (independent_property): 134
  businesses (unified_brand_only): 18
  business_branches created: 412
  
API usage:
  Text Search calls: 2,341
  Place Details calls: 2,224
  Estimated cost: $XX.XX
  
Items needing manual review:  /scrapers/output/review_needed.csv
```

---

## 9. Phase G — Verification

**Goal:** sanity-check the populated database before signing off.

### Verification queries

```sql
-- Row counts
SELECT 'brands' AS tbl, COUNT(*) FROM brands
UNION ALL SELECT 'businesses', COUNT(*) FROM businesses
UNION ALL SELECT 'business_branches', COUNT(*) FROM business_branches
ORDER BY tbl;

-- Distribution by consolidation_mode
SELECT consolidation_mode, COUNT(*) 
FROM businesses 
GROUP BY consolidation_mode 
ORDER BY consolidation_mode;

-- Distribution by emirate (excluding parent rows that don't have emirate)
SELECT e.name_en, COUNT(b.id) 
FROM emirates e 
LEFT JOIN businesses b ON b.emirate_id = e.id
GROUP BY e.name_en, e.sort_order
ORDER BY e.sort_order;

-- Distribution by life moment
SELECT lm.name_en AS life_moment, COUNT(b.id) AS business_count
FROM life_moments lm
LEFT JOIN categories c ON c.life_moment_id = lm.id
LEFT JOIN businesses b ON b.category_id = c.id
GROUP BY lm.name_en, lm.sort_order
ORDER BY lm.sort_order;

-- Top 10 brands by branch count
SELECT br.name_en, COUNT(bb.id) AS branch_count
FROM brands br
LEFT JOIN businesses b ON b.brand_id = br.id
LEFT JOIN business_branches bb ON bb.business_id = b.id
GROUP BY br.name_en
ORDER BY branch_count DESC NULLS LAST
LIMIT 10;

-- Sanity check: businesses with NULL location data that aren't parents
SELECT id, name_en, consolidation_mode
FROM businesses
WHERE (lat IS NULL OR lng IS NULL OR address IS NULL)
  AND consolidation_mode != 'unified_with_branches_parent'
LIMIT 20;
-- Expected: 0 rows. Any results = data quality issue.

-- Sanity check: branches without parent
SELECT bb.id, bb.name_en
FROM business_branches bb
LEFT JOIN businesses b ON b.id = bb.business_id
WHERE b.id IS NULL OR b.consolidation_mode != 'unified_with_branches_parent'
LIMIT 20;
-- Expected: 0 rows.

-- Duplicate place_ids check
SELECT google_place_id, COUNT(*)
FROM (
    SELECT google_place_id FROM businesses WHERE google_place_id IS NOT NULL
    UNION ALL
    SELECT google_place_id FROM business_branches WHERE google_place_id IS NOT NULL
) AS combined
GROUP BY google_place_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows.
```

### Expected ranges (loose)

After Phase F, expect:
- **brands**: 40-80
- **businesses (all modes)**: 1,800-2,800
- **business_branches**: 300-700

If counts are wildly different (e.g., 50 businesses total or 50,000), STOP and report.

---

## 10. Phase H — Rollback

If at any point the build needs to be undone:

### Soft rollback (preserve scraped data)

```sql
BEGIN;

-- Drop new tables
DROP TABLE IF EXISTS business_branches CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS life_moments CASCADE;
DROP TABLE IF EXISTS areas CASCADE;
DROP TABLE IF EXISTS emirates CASCADE;

DROP TYPE IF EXISTS consolidation_mode_enum;

-- Restore legacy
ALTER TABLE legacy_businesses RENAME TO businesses;
ALTER TABLE legacy_business_cards RENAME TO business_cards;
ALTER TABLE legacy_categories RENAME TO categories;

COMMIT;
```

### Hard rollback (restore from Supabase backup)

If soft rollback fails or data corruption is detected:

```
Manual step: Basem → Supabase Dashboard → Database → Backups
→ Select pre-build backup → Restore
```

---

## 11. Sign-off checklist

When Phase G verification passes, produce a final report:

- [ ] All 7 new tables created
- [ ] 3 legacy tables renamed and preserved
- [ ] Taxonomy seeded: 3 emirates, ~50 areas, 9 life moments, 66 categories
- [ ] Businesses populated from curated sources
- [ ] Chain detection ran cleanly (top chains have multi-branch records)
- [ ] No orphan branches, no duplicate place_ids
- [ ] Google Places API budget remaining: $XX
- [ ] Total Phase 1 API cost: $XX
- [ ] Items needing manual review: N rows in review_needed.csv

Report this to Basem and await confirmation before considering the build complete.

---

## Appendix A — Open issues for Basem

Things that emerged during this design that may need attention before or during execution:

1. **Category count discrepancy**: design notes say 66 categories, the seed SQL produces 65. The pets category was added under Shopping & home (14 categories there now). Re-verify count totals.

2. **Photography category retained** based on Basem's final call ("Keep as 'Photography & videography services'"). Low expected review volume — may end up sparse at launch.

3. **Hospitals/schools "private only" filter** must be enforced at ingestion in Phase F. Skip any business where Google Places `types` or source data indicates government operation.

4. **Arabic names** are draft translations. Native UAE Arabic speaker review recommended before public launch.

5. **Pets placement** under Shopping & home was chosen to avoid Family & kids cultural sensitivity. Alternative: revisit in Phase 2 once user data shows whether pet owners actually look here.

6. **Real estate dropped** as a life moment (low review-worthiness per resident). Property listing platforms (Bayut, Property Finder) dropped from Apps & platforms (utility middleware, no choice signal).

7. **Government & utility apps dropped** (regulatory risk, no consumer choice).

8. **Visa/PRO, translation, legal, accounting, money exchange dropped** (transactional, not experiential — fail the "would I record a 30-second video about this?" test).

---

## Appendix B — Source code structure recommendation

```
/reviewencer-backend/
├── PHASE1_BUILD.md                 # this document
├── migrations/
│   ├── 001_phase_a_schema.sql      # extracted SQL from Phase A
│   ├── 002_phase_b_taxonomy.sql    # extracted SQL from Phase B
│   └── verify.sql                  # all verification queries from each phase
├── scrapers/
│   ├── __init__.py
│   ├── time_out.py                 # Phase C
│   ├── khda.py                     # Phase D1
│   ├── adek.py                     # Phase D2
│   ├── dha.py                      # Phase D4
│   ├── ...
│   ├── combiner.py                 # produces curated_combined.csv
│   ├── deduplicator.py             # produces curated_deduplicated.csv
│   └── output/
│       ├── time_out_raw.csv
│       ├── khda_raw.csv
│       ├── ...
│       ├── curated_combined.csv
│       ├── curated_deduplicated.csv
│       └── APPROVED.flag           # Basem touches this when approved
├── enrichment/
│   ├── google_places.py            # API client
│   ├── chain_detector.py           # match against curated chain list
│   ├── populator.py                # main entry point for Phase F
│   └── progress.json               # resume state
└── reports/
    ├── phase_a_verify.txt
    ├── phase_b_verify.txt
    ├── phase_f_summary.txt
    └── review_needed.csv           # rows flagged for manual review
```

---

**END OF DOCUMENT**

This is the source of truth for Phase 1 build. Update as decisions evolve. Track changes via git.
