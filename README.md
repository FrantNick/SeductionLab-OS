# Seduction Lab OS — V2

Marketing experimentation and affiliate attribution platform. Admins define
campaigns (marketing angles) for products; affiliates post Twitter/X threads,
drive clicks through tracked redirect links, and climb cached leaderboards.
V2 adds the platform layer: notifications, runtime settings, feature flags,
audit logs, job tracking, experiments, integrations, proxy management and a
provider-agnostic AI stack (providers, per-feature model configs, versioned
prompts, knowledge base, chat). Revenue is entered manually (webhook
attribution is next — see `ROADMAP.md`).

**Stack:** Next.js App Router (TypeScript) · PostgreSQL + Prisma · Auth.js
(credentials, JWT) · Tailwind CSS · Recharts · Apify (thread metrics).

**Docs:** [HANDOFF.md](HANDOFF.md) (technical handoff) ·
[ARCHITECTURE.md](ARCHITECTURE.md) (system design) ·
[ROADMAP.md](ROADMAP.md) (V1.1 → V3).

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env        # then edit DATABASE_URL, AUTH_SECRET, etc.

# 3. Database
npm run db:migrate          # create schema (prisma migrate dev)
npm run db:seed             # admin account + optional demo data

# 4. Run
npm run dev                 # app on http://localhost:3000
npm run jobs:dev            # local job scheduler (leaderboard + Apify refresh)
```

Seeded accounts (change via `SEED_ADMIN_*` env vars):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@seduction-lab.com` | `admin12345` |
| Demo affiliates | `maya@example.com`, `dex@example.com`, `lena@example.com` | `affiliate123` |

Set `SEED_DEMO_DATA="false"` to seed only the admin account.

---

## How the system fits together

```
Admin creates Product ──► Campaign (angle, instructions, hook/CTA)
                              │ assigns
Affiliate ◄───────────────────┘
   │ POST /api/tracking/generate  ──► TrackingLink (/go/{slug})
   │ posts thread on X
   │ POST /api/threads            ──► Thread ──► Apify ──► ThreadMetrics (snapshots)
Visitor clicks /go/{slug}         ──► Click (ipHash, UA, country, full attribution)
Admin POST /api/conversions/manual──► Conversion (revenue, V1 manual)
Cron every 10 min                 ──► LeaderboardEntry (cached rankings)
```

Separation of concerns is strict: threads (content), metrics (Apify),
clicks (tracking) and conversions (sales) are independent tables — the DB is
the source of truth and the UI only visualizes it.

**Analytics definitions:** CTR = clicks ÷ views · CVR = conversions ÷ clicks.
Clicks/revenue are recorded per (affiliate, campaign); for per-thread rankings
they are attributed proportionally to each thread's share of views.

## Routes

### Public
- `GET /go/[slug]` — logs a Click (salted-hash IP, user agent, country) and
  302-redirects to the product checkout URL with UTM attribution.
- `/login`, `/register` — Auth.js credentials; self-registration always
  creates an AFFILIATE. Admins are seeded.

### Affiliate (`/dashboard`)
- Overview: period stats (today/yesterday/7d/30d), charts, notifications,
  assigned campaigns, active experiments, best threads, leaderboard + own rank.
- Campaigns: assigned campaigns with angle/playbook + tracking-link generator.
- Threads: submit thread URL, metrics table, thread detail with snapshot charts.
- Tracking links: all links with click counts. Leaderboard: global +
  per-campaign with rank movement. Settings: profile, password, timezone,
  notification preferences.

### Admin (`/admin`)
- Overview: global analytics + quick actions; Campaigns: create/edit/assign;
  Affiliates: activate/pause/ban; Analytics: CTR & revenue per campaign, top
  affiliates, top threads by views/CTR/revenue; Conversions: manual revenue
  entry; Products: catalog; Leaderboard: global + per-campaign.
- Experiments: time-bound tests over campaigns (cohort, goal, winner).
- AI: providers (encrypted keys, live validation), per-feature model configs,
  versioned prompts, knowledge base, chat over live platform data.
- Integrations: Apify/Stripe/Shopify/Gumroad/LLM credentials with real
  validation and honest status. Proxies: outbound routes, health, per-service
  assignment. Audit log: every privileged action. Settings: branding,
  tracking domain, defaults, feature flags, service status. Debug: job
  triggers, cron status, env checks, DB stats, test link generator.

### API
| Route | Auth | Purpose |
|---|---|---|
| `POST /api/tracking/generate` | affiliate | `{campaignId, productId?}` → `/go/{slug}` URL (idempotent per affiliate+campaign+product) |
| `POST /api/threads` | affiliate | `{campaignId, twitterUrl}` → Thread (+ initial Apify scrape) |
| `GET /api/threads` | affiliate | own threads with latest metrics |
| `POST /api/apify/scrape-thread` | owner/admin | `{threadId}` → new ThreadMetrics snapshot |
| `POST /api/conversions/manual` | admin | `{affiliateId, campaignId, revenue, sourceClickId?}` |
| `POST /api/register` | public | affiliate sign-up |
| `GET/POST /api/cron/refresh-metrics` | `CRON_SECRET` | re-scrape all threads (every 6 h) |
| `GET/POST /api/cron/leaderboard` | `CRON_SECRET` | recompute cached leaderboards (every 10 min) |

## Background jobs

Production: Vercel Cron (`vercel.json`) hits the two `/api/cron/*` endpoints —
send `Authorization: Bearer $CRON_SECRET` (or `?secret=`) from any external
scheduler when self-hosting. Local development: `npm run jobs:dev`.

Leaderboards are **cached aggregations** (`LeaderboardEntry`, global + per
campaign, ranked by revenue → clicks → views); reads never aggregate live
data, except a one-time compute when the cache is empty.

## Apify integration

`POST /api/apify/scrape-thread` and the refresh job run the
`goat255/twitter-tweet-scraper` actor (`APIFY_ACTOR_ID`) through Apify's
`run-sync-get-dataset-items` API and append a `ThreadMetrics` snapshot per
scrape (metric history powers the charts). Field extraction is defensive to
tolerate actor output variations. Without `APIFY_TOKEN` the system degrades
gracefully — submissions still work, scraping reports "disabled".

## Environment variables

See `.env.example` — `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`,
`TRACKING_DOMAIN` (e.g. `https://go.seduction-lab.com`), `IP_HASH_SALT`,
`APIFY_TOKEN`, `APIFY_ACTOR_ID`, `CRON_SECRET`, `SEED_*`.

## V1 boundaries (by design)

No Shopify/Gumroad integration (manual conversions), no queue infrastructure
(cron-triggered jobs), no microservices. The `Conversion.sourceClickId` field
already supports click-level attribution for V2 webhooks.
