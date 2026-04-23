# Reviewencer

> AI-native, video-first review platform for the UAE. Chat-first discovery, real phone-verified reviewers, UAE-legal moderation baked in.

![stack](https://img.shields.io/badge/stack-Next.js%2014%20%7C%20Supabase%20%7C%20Claude%20%7C%20Whisper-2B8BFF)
![license](https://img.shields.io/badge/license-proprietary-blue)

Reviewencer is what happens when you cross TikTok, Trustpilot and Perplexity for the UAE market. Ask any question — *"Which UAE bank has the fastest app?"*, *"أي توصيل أكل أسرع؟"* — and get a plain-English answer backed by real, cited reviews. Reviewers drop 60-second videos that auto-transcribe so they're searchable. Every review is moderated against UAE Federal Decree-Law 34/2021 before it goes live.

## Stack

- **Next.js 14** App Router + React Server Components + TypeScript
- **Supabase** — Postgres 15 + `pgvector` + Auth (phone OTP) + Storage + RLS
- **Anthropic Claude** (`claude-sonnet-4-6`) — chat answers, business summaries, UAE-legal moderation
- **OpenAI** — `text-embedding-3-small` for RAG, `whisper-1` for video transcription
- **Tailwind CSS** with a custom blue → purple brand palette
- **IBM Plex Sans Arabic** + **Inter** for bilingual EN/AR

## Quick start

```bash
# 1. Install
pnpm install   # or npm / yarn

# 2. Copy env and fill in your keys
cp .env.example .env.local

# 3. Push schema to Supabase (creates tables, enums, RLS, RPCs, triggers)
pnpm db:push

# 4. Seed sample UAE businesses + reviews
pnpm db:seed

# 5. Run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.example`. Required:

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only.** Used for moderation & summary writes |
| `SUPABASE_DB_URL` | Direct Postgres URL (for `db:push` / `db:seed`) |
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | Embeddings + Whisper |
| `NEXT_PUBLIC_APP_URL` | Public site URL for share cards |
| `MODERATION_STRICT_MODE` | `true` → every review goes through manual moderation |

## Supabase setup

1. **Create project** at [supabase.com](https://supabase.com). Pick `me-central-1` (UAE) or `eu-central-1` for proximity.
2. **Enable extensions:** `pgvector`, `pgcrypto`, `uuid-ossp`.  The schema enables them with `CREATE EXTENSION IF NOT EXISTS`, but verify in **Database → Extensions**.
3. **Phone auth:** Authentication → Providers → **Phone**. Enable WhatsApp (via Twilio or MessageBird) as primary, SMS as fallback. Set rate limits to 3 OTPs / hour.
4. **Storage bucket:** Storage → **New bucket** → `reviews`. Make it **private**. Policy:  users can upload under their own user-id prefix; playback URLs are signed.
5. **Run `pnpm db:push`** — creates tables, enums, RLS policies, `match_reviews()` RPC, `business_cards` + `feed_reviews` views, triggers.
6. **Run `pnpm db:seed`** — six UAE categories, sample businesses (ENBD, talabat, Careem, du, etisalat, etc.), demo reviews.
7. **Backfill embeddings:** `pnpm embed:backfill` generates embeddings for seeded reviews.

## Architecture

```
┌──────────────────────────┐  ┌───────────────────┐
│  Next.js App Router      │  │  Supabase         │
│  - /ask (chat)           │  │  - Postgres+pgvec │
│  - /business/[slug]      │◄─┤  - Auth (OTP)     │
│  - /record (video)       │  │  - Storage        │
│  - /admin/moderation     │  │  - RLS            │
│  - /api/*  route handlers│  └───────────────────┘
└──────────┬───────────────┘             ▲
           │                             │ service-role (server-only)
           │  POST /api/chat             │
           ▼                             │
     ┌────────────┐   embed   ┌──────────┴──────────┐
     │   RAG      │──────────▶│ text-embedding-3-sm │
     │ (src/lib/  │ match_*   │     (OpenAI)        │
     │  rag.ts)   │◄──────────┴─────────────────────┘
     └─────┬──────┘
           │ comparison prompt
           ▼
     ┌────────────┐
     │  Claude    │  claude-sonnet-4-6
     │  (sonnet)  │
     └────────────┘
```

### Request flow: `POST /api/chat`

1. Rate-limit by `sessionId` (30 req/min in-memory; swap for Redis in prod).
2. Embed the user query with OpenAI.
3. Call `match_reviews(embedding, category_filter, match_count)` RPC — cosine similarity over `pgvector`.
4. Group matched reviews by business.
5. Send to Claude with a structured prompt → JSON `ChatAnswer { prose, comparison[], follow_ups[], cited_review_ids[] }`.
6. Persist turn to `chat_messages` for analytics.
7. Return sanitized JSON.

### Moderation pipeline

Every new review runs `moderateAndRecord()` synchronously:

1. Claude sees the review text and returns `{ status, risk_categories[], rationale, suggested_edit }`.
2. `status` is one of `auto_approved` → goes live, `flagged` → goes to `/admin/moderation`, `rejected` → hidden from user feeds.
3. A `moderation_events` row records who/what/when/model/why (audit trail).
4. Risk categories align with UAE law: `defamation`, `insult`, `commercial_disparage`, `religion_politics`, `private_info`, `hate_speech`, `spam_fake`, `low_risk`.
5. `MODERATION_STRICT_MODE=true` forces every review to `flagged`.

## Deploy to Vercel

```bash
vercel link
vercel env pull .env.local     # after setting all env vars in Vercel dashboard
vercel deploy --prod
```

Node.js runtime is required (not edge) for the route handlers that use the OpenAI / Anthropic SDKs.

**Regions:** pick `fra1` or `cdg1` for UAE-proximate cold-start latency. Pair with a Supabase project in `eu-central-1` or `me-central-1`.

### Scale path

| Phase | Do this |
| --- | --- |
| 0-10K reviews | Keep Supabase Storage. In-memory rate limit. |
| 10K-1M | Switch to **Mux** for video (HLS, signed playback, DRM). Move rate limit to Upstash Redis. |
| 1M+ | Move embeddings to a dedicated vector DB (pgvector stays fine, but `ivfflat` → `hnsw` index). Add a moderation worker queue (Inngest / Trigger.dev). |

## Project structure

```
reviewencer-app/
├─ src/
│  ├─ app/                 # App Router pages + route handlers
│  │  ├─ api/              # Route handlers (chat, review, moderation, auth, etc.)
│  │  ├─ admin/moderation/ # Moderator queue
│  │  ├─ ask/              # AI chat page
│  │  ├─ business/[slug]/  # Business detail page
│  │  ├─ categories/
│  │  ├─ feed/
│  │  ├─ profile/
│  │  ├─ record/           # Record video review flow
│  │  ├─ (legal)/legal/    # Legal pages
│  │  └─ layout.tsx
│  ├─ components/          # Nav, Hero, ChatPanel, ComparisonCard, PhonePreview…
│  └─ lib/                 # env, supabase clients, claude, openai, rag, moderation…
├─ supabase/
│  ├─ schema.sql           # Tables, enums, RLS, RPCs, views, triggers
│  └─ seed.sql             # Demo UAE data
├─ public/                 # Static assets (favicon, OG images)
├─ scripts/                # embed-backfill, rebuild-summaries
├─ tailwind.config.ts
├─ next.config.js
└─ package.json
```

## Development notes

- **Server-only imports:** anything that touches the service-role key imports `'server-only'`. If you see a client bundle include that file, Next.js will fail the build.
- **RLS:** enabled on every table. Service-role bypasses it — guard those paths.
- **RTL:** the EN/AR toggle in `Nav` sets `document.documentElement.dir`. Use `.flip-rtl` helper for icons.
- **Videos:** `<= 60 s`, uploaded to `reviews/{user_id}/{uuid}.webm`. Transcription capped at 25MB.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm db:push` | Apply `supabase/schema.sql` to `$SUPABASE_DB_URL` |
| `pnpm db:seed` | Apply `supabase/seed.sql` |
| `pnpm embed:backfill` | Generate embeddings for reviews missing them |
| `pnpm summaries:rebuild` | Rebuild AI summaries for businesses with stale data |

## Legal

Reviewencer operates under UAE law. See `/legal/uae-compliance` for the public policy. The moderation model references **Federal Decree-Law 34 of 2021** (Cybercrimes) and the **Penal Code** defamation provisions. Moderator decisions are logged in `moderation_events` with full audit trail.

---

Built with trust 🇦🇪 · reviewencer.ae
