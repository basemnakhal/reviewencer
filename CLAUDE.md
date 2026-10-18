# Reviewencer

Video-first review platform for UAE businesses, English + Arabic (RTL). Two apps share one Supabase project.

| Path | What |
|---|---|
| `/` (root) | Next.js 14 web app — chat/RAG discovery, business pages, moderator queue (`src/app/admin/moderation`) |
| `mobile/` | Expo (SDK 55, expo-router) mobile app — TikTok-style feed, phone OTP sign-in, video/text reviews |
| `supabase/schema.sql` | Web app's original schema (stale — the live DB has moved on; see below) |
| `mobile/supabase/migrations/` | Migrations applied to the live DB since Oct 2026 (source of truth for recent changes) |
| `mobile/supabase/functions/` | Edge Functions: `process-review` (Whisper + Claude summary), `moderate-review` (UAE-law moderation → publish/flag/reject) |

Nothing should depend on a local machine: code lives on GitHub, backend on Supabase, app builds/updates on EAS.

## Supabase

- Project ref `emlugufvlypbkyudforz` (single project — it is production; test data lands in the live DB).
- The Supabase MCP tools work for reads and `execute_sql`, but `apply_migration` with `drop`/`revoke` statements gets auto-declined in the desktop app. For those, write the migration file and have the user run it in the SQL Editor: https://supabase.com/dashboard/project/emlugufvlypbkyudforz/sql/new
- Edge Function secrets: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (set in dashboard). Never put AI keys in `EXPO_PUBLIC_*` vars — those are bundled into the app.

### Schema notes
- `businesses` (11k rows, migrated from `legacy_businesses`): `name_en`/`name_ar`, `logo_url`, `category_id` → `categories` (uuid). Select as `name:name_en, logo_url, category:categories(name_en, name_ar)`; render category with `getCategoryLabel()` in `mobile/lib/categories.ts`.
- Taxonomy: `life_moments` → `categories`. Locations: `emirates` (only DXB/AUH/SHJ so far) → `areas`.
- `reviews.moderation_status`: `pending` → `published` / `flagged` / `rejected`. Feed shows only `published`. The mobile app inserts `pending`, then calls `moderate-review`; decisions are logged in `moderation_events`.
- Security model (see `20261018120000_security_hardening.sql`): clients can insert reviews only as themselves with status `pending`, and can only write content columns; profiles' `role`/`tier` are not client-writable; `private.is_moderator_or_admin()` backs moderator RLS. Status changes happen server-side (service role) only.
- Tiers come from Legit votes via triggers (`sync_legit_count_and_tier`, `trigger_sync_author_tier`).
- Web compatibility views (`20261018150000_web_compat_views.sql`): `business_cards` and `feed_reviews` expose the new schema in the shape the web app reads (`name`, `logo_url`, `category_id` = category **slug**). `match_reviews()` filters by category slug.
- `businesses` currently holds the 11,039 `source = 'legacy_import'` rows. `PHASE1_BUILD.md` describes the intended curated rebuild (Time Out + regulators + Google Places); phases C–F were never run. Swap legacy rows out when curated data exists.

## Web app (root)

- `npx pnpm@9 install`, `npx pnpm@9 build`, `npx pnpm@9 dev` (pnpm lockfile). Env in `.env.local` (see `.env.example`); scripts in `scripts/` read keys from `.env.local` — never hardcode keys.
- Categories: `src/lib/categories.ts` lists featured slugs; `categoryLabel(slug)` renders any slug. Logos: `<BusinessLogo logo={url} />`.
- `/record` loads businesses for a dropdown — PostgREST caps it at 1000 rows; needs a search box before real use.

## Mobile app (`mobile/`)

- Start dev server: `npx.cmd expo start --offline` (Windows PowerShell blocks `npx.ps1`; `--offline` avoids an Expo-API error). Needs the dev build on the phone. `--tunnel` works only if ngrok is reachable.
- Typecheck: `npx tsc --noEmit -p .` — one pre-existing error in `app/tabs/me.tsx` (`text: string | null` vs `ReviewCardProps`).
- Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public by design). Locally in `mobile/.env` (gitignored); for cloud builds in EAS environment variables.
- Storage: `reviews` bucket (videos at `videos/<user id>_<ts>.mp4`), `avatars` bucket (`<user id>.<ext>`).
- `app/submit.tsx` is an unused older review flow; `app/tabs/search.tsx` is a placeholder.
- i18n strings: `mobile/lib/translations.ts` (add every key to both `en` and `ar`).

## Cloud builds & updates (EAS, Expo account `basem.nakhal`)

Run from `mobile/` (`npx eas-cli@latest ...`; on Windows PowerShell use `npx.cmd`). Env vars for builds/updates live in EAS environments (development / preview / production) — only the two public Supabase vars.

- Installable Android app (APK, no laptop needed): `eas build --profile preview --platform android`
- Ship JS/UI changes to installed apps over the air: `eas update --channel preview --environment preview --message "..."`
- `runtimeVersion` policy is `appVersion`: changes that add/upgrade native modules (new `expo-*` packages, app.json native config) need a new build and a `version` bump in `app.json`; plain JS/TS changes only need `eas update`.
- Channels: `development` (dev client), `preview` (testers / the owner's phone), `production` (store builds).

## Conventions

- Commit after each completed change and push to `main` (the repo is the backup). This machine may have no git identity; use `git -c user.name="Basem Nakhal" -c user.email="basemnakhal@gmail.com" commit ...`.
- The user is not a developer by trade — give click-by-click steps for dashboard tasks and direct links.
