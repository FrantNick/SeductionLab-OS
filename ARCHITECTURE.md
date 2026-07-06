# Seduction Lab OS — Architecture

The platform is a single Next.js App Router application over PostgreSQL.
Guiding principle: **the database is the source of truth; the UI only
visualizes it.** Content (threads), engagement (metrics), traffic (clicks) and
money (conversions) are independent tables joined by attribution keys — no
pipeline can corrupt another.

## 1. Request flow

```
Browser ──► middleware.ts (JWT session, role routing)
   │
   ├─ Server Components (pages) ──► src/lib/* ──► Prisma ──► PostgreSQL
   │        │ render                 business logic
   │        └─ <form action={serverAction}> ──► requireAdmin() ──► lib ──► revalidatePath
   │
   ├─ Client Components ──► lib/api-client.ts ──► /api/* routes
   │   (toasts, chat, uploads)   typed fetch        │ withErrorHandling + zod
   │                                                └──► lib ──► Prisma
   └─ Public: /go/[slug] ──► Click insert ──► 302 redirect
```

Three mutation paths, one rule each:
- **Server actions** (admin/affiliate CRUD): always begin with an auth guard,
  end with `revalidatePath`.
- **API routes** (client-interactive + machine callers): `withErrorHandling`
  wrapper, zod validation, `jsonError` responses.
- **Cron routes**: shared-secret gate (`isAuthorizedCron`), record a `JobRun`.

## 2. Identity & authorization

```
User (role: ADMIN | AFFILIATE) ──1:1── Affiliate (profile, status)
```

- Auth.js credentials → bcrypt check → JWT carrying `{ role, affiliateId }`.
- `middleware.ts` routes by role (affiliates never see `/admin`).
- Every action/route re-validates via `requireSession / requireAdmin /
  requireAffiliate` — authorization is enforced server-side at the data
  boundary, not in the UI.
- Privileged mutations write `AuditLog` rows through a **typed action union**
  (`lib/audit.ts`), so unknown action strings fail the build.

## 3. Attribution data model

```
Product (landingUrl)
         ─┬─ Campaign ─┬─ CampaignAssignment ── Affiliate (handle)
          │            ├─ TrackingLink ──1:1── Thread ── ThreadMetrics (append-only)
          │            │        └── Click (ipHash, UA, country)
          │            └─ Conversion (revenue, sourceClickId → Click)
          └─ Experiment ── ExperimentAssignment ── Affiliate
```

- **Products carry one landing-page URL shared by every affiliate** — never
  affiliate-specific checkouts. Personalization happens in the URL:
  `landingUrl?affiliate=<handle>&ref=<slug>`; the landing page's JS reads the
  affiliate param and swaps its CTA to that affiliate's checkout. Different
  affiliates never need different Products, only different generated URLs.
- `Affiliate.handle` is the unique URL-safe identifier carried by the
  affiliate parameter (auto-slugified from displayName at signup, backfilled
  by migration, id fallback when null).
- `AffiliateProductUrl` (unique per affiliate × product) is an admin-set
  destination override used verbatim by the redirect — for affiliates who
  need a hand-crafted URL on a given product without touching the automatic
  builder everyone else uses.
- Threads and links carry optional `threadName`/`threadDescription`
  (planned on the link, inherited at submission, editable after);
  `Thread.createdAt` records platform submission time and anchors the
  bot-filter window (`postedAt` remains free to hold the real tweet time).

- **One link per thread.** Affiliates create unlimited `TrackingLink`s inside
  a campaign — one before each thread they post. `TrackingLink.threadId` is
  nullable (unused link) and **unique** (a thread owns at most one link, a
  link belongs to at most one thread). Binding happens at thread submission
  and is race-safe (`updateMany` guarded on `threadId: null` inside the
  creation transaction).
- **Exact click attribution** follows the chain
  `Click → TrackingLink → Thread → Campaign`: every click belongs to exactly
  one thread. Thread CTR = its link's clicks ÷ its latest views; thread
  revenue = conversions whose `sourceClick` came through its link. The
  previous view-share estimation is gone.
- `Click` still stores `affiliateId + campaignId` redundantly: attribution
  survives any future link/campaign edits and needs no joins.
- `ThreadMetrics` is append-only — the latest row is "now", the series is the
  chart. Nothing is ever overwritten, so history cannot be lost.
- `Conversion.sourceClickId` (nullable) makes a sale exactly attributable to
  a click → link → thread; webhooks will look up the click by `ref` slug +
  recency and set it.
- Pre-migration threads have no bound link (`threadId = NULL` on their old
  links) and can be bound manually from the thread detail page; until then
  they report 0 exact clicks while campaign/affiliate totals stay correct.
- Experiments add **no new event pipes** — they scope existing clicks/
  conversions/threads to `[startDate, endDate] × cohort` at read time
  (`lib/experiments.ts`), so campaigns behave identically with or without an
  experiment running.

## 4. Tracking pipeline (privacy-first)

```
1. Create link   POST /api/tracking/generate → new slug (unused, threadId NULL)
2. Post thread   affiliate puts /go/{slug} inside the thread on X
3. Submit thread POST /api/threads {campaignId, twitterUrl, trackingLinkId}
                 └─ transaction: create Thread + bind link (threadId ← thread.id)

GET /go/{slug}
  ├─ resolve TrackingLink (slug unique) + product + affiliate + thread.createdAt
  ├─ bot filter: thread bound AND now − thread.createdAt < tracking.botFilterMinutes?
  │     yes → skip click logging (visitor still redirected; 0 disables)
  ├─ INSERT Click { sha256(salt + ip), userAgent, country?, full attribution }
  └─ 302 → destination, resolved in order:
       1. AffiliateProductUrl(affiliateId, productId).destinationUrl  — verbatim
       2. landingUrl?{affiliateParam}={handle}&{trackingParam}={slug} — automatic
       3. link.destinationUrl snapshot                                — last resort
```

The destination is **built at redirect time** from the product's landing URL
and the parameter names in AppSettings (`tracking.affiliateParam`, default
`affiliate`; `tracking.trackingParam`, default `ref`) — nothing is hardcoded,
and changing the landing URL or the names updates every existing link
instantly. The `destinationUrl` snapshot stored on each link is only the
fallback if that computation fails. Storefront-agnostic by design: Shopify,
Gumroad, LemonSqueezy or any landing page can read the params, extra params
are one entry in the generic `buildLandingUrl()` map, and the `ref` slug
resolves link → affiliate → campaign → thread server-side — so future
attribution needs require no schema change.

Raw IPs are never persisted — only salted hashes (`IP_HASH_SALT`), enough for
dedup/fraud heuristics without storing PII. Country comes from host geo
headers when present. Click logging is fire-and-forget: a DB hiccup must not
break the visitor's redirect.

## 5. Metrics ingestion (compliant by design)

```
Thread submit ──► parse & validate URL ──► store Thread
      │                                        │
      └────────── initial scrape ──────────────┤
Cron (6h) ── for each thread of active campaign┤──► Apify actor (official API)
Manual refresh (owner/admin) ──────────────────┘        │
                                            append ThreadMetrics snapshot
```

Engagement data comes only from the Apify platform API (licensed data
provider) with credentials from the Integration store (env fallback). The
`goat255/twitter-tweet-scraper` actor is invoked via
`POST /v2/acts/{actorId}/run-sync-get-dataset-items` with the payload

```json
{ "tweetUrls": ["https://x.com/user/status/123…"] }
```

— the actor requires at least one entry in `usernames` or `tweetUrls`; the
platform always scrapes one exact tweet. A `proxyConfiguration` block is added
only when an outbound proxy is assigned to the `apify` service. Actor errors
(`{"error":{"type","message"}}`) are parsed and surfaced verbatim to the UI
and JobRun records. Metric extraction is shape-tolerant, first match wins:

```
views:    metrics.views    → views    → viewCount    → view_count → impressions
likes:    metrics.likes    → likes    → likeCount    → favorite_count → legacy.favorite_count
replies:  metrics.replies  → replies  → replyCount   → reply_count → legacy.reply_count
retweets: metrics.retweets → retweets → retweetCount → retweet_count → legacy.retweet_count
quotes:   metrics.quotes   → quotes   → quoteCount   → quote_count → legacy.quote_count
```

Missing fields default to 0 — an actor output change can never crash a
scrape. Sequential scraping avoids hammering the actor; failures degrade
gracefully with per-thread error detail on the `JobRun`. No scraping
bypasses, no fabricated numbers: unconfigured = visibly disabled.

## 6. Leaderboards (cached aggregation)

```
computeLeaderboards()               reads
  scopes = [global, ...campaigns]   getLeaderboard(scope) ──► LeaderboardEntry
  per scope:                           (cache only; lazy compute if empty)
    aggregate clicks/revenue/views
    rank: revenue → clicks → views
    carry previousRank  ──► movement badges (▲ ▼ new)
    transactional delete+createMany
```

Recomputed every 10 minutes by cron (and on demand from the UI). Readers
never aggregate live data, so leaderboard pages stay O(limit).

## 7. AI subsystem

```
feature key ("chat-assistant")
   │  AiModelConfig (enabled, model, temperature, maxTokens, reasoning)
   ├─► AiProvider (kind, baseUrl, AES-256-GCM key) ──► adapter
   │        OPENAI_COMPATIBLE → POST {base}/chat/completions
   │        ANTHROPIC         → POST {base}/messages
   └─► Prompt.activeVersion (versioned, rollback = repoint)

runAssistantTurn():
  system = prompt + live platform snapshot (products, campaigns, stats,
           leaderboard, experiments) + keyword-matched knowledge chunks
  → provider call → persist AiMessage pair (only on success)
```

Layering is strict: **adapters** know wire formats only; **service** resolves
configuration; **context** builds retrieval; **registry** is dependency-free
constants (safe for client and seed imports). `AiNotConfiguredError` surfaces
as HTTP 503 — the UI renders an honest "not configured" state and a link to
the config screen. Knowledge documents are chunked on ingest
(1500 chars / 200 overlap); `KnowledgeChunk.embedding` is reserved so a vector
pipeline only fills a column behind the same `searchKnowledge()` signature.
`AiInsight` is the write target for future analysis jobs (hook detection,
thread grading, daily summaries) — DB and UI slots exist before the jobs do.

## 8. Integrations & egress

```
INTEGRATION_DEFS (registry) ──► Integration row (credentialEncrypted, config,
                                 status, statusDetail, lastCheckedAt)
consumers: getIntegrationCredential(slug)  — DB first, env fallback (Apify)
validators: live API check on save — status is measured, never assumed

ProxyAssignment(service) ──► Proxy (TCP health, latency, success/failure)
  services: "apify", "ai" — reliability & geo-routing for authorized traffic only
```

Secrets are encrypted with AES-256-GCM (`lib/crypto.ts`), never logged, never
serialized to the client (forms show placeholders, not values).

## 9. Platform services

```
FeatureFlag ──► isFlagEnabled() ──► gates nav (layout), pages, APIs
AppSetting  ──► getSetting()    ──► branding, tracking domain, defaults
Notification──► notify()/notifyAffiliate() ──► in-app feed (+ toasts client-side)
AuditLog    ──► logAudit()      ──► /admin/audit (search + pagination)
JobRun      ──► executeJob()    ──► debug panel, settings status, error feed
```

Both registries (`FLAG_DEFS`, `SETTING_DEFS`) define defaults in code and
overlay DB rows, so a missing row can never crash a page and new deploys
self-register their keys.

## 10. Background execution

```
vercel.json cron ──────► /api/cron/leaderboard      (*/10 min)
                 ──────► /api/cron/refresh-metrics  (0 */6 h)
self-host: PM2 ──► scripts/jobs-cron.mjs ──► same endpoints on localhost
   auth: Bearer CRON_SECRET or ?secret=
Admin UI ──► POST /api/admin/jobs {job|"all"}   (audited, requireAdmin)
Local dev ──► scripts/jobs-dev.ts (direct calls — records NO JobRuns)
Endpoint/API paths ──► executeJob() ──► JobRun row (status, trigger, result, error)
```

## 10b. Self-host topology (Windows PC + ngrok)

```
X click on /go/{slug}
   │ https://go.seduction-lab.com  (stable reserved ngrok domain — TLS ends here)
   ▼
ngrok agent (native Windows service) ──► http://localhost:3000
   ▼
Next.js (PM2: seductionlab-web) ──► /go/[slug]
   ├─ INSERT Click (ipHash, UA; country = null — ngrok sends no geo header)
   └─ 302 → landingUrl?affiliate=<handle>&ref=<slug>

PM2: seductionlab-jobs ──► localhost /api/cron/* every 10m/6h (CRON_SECRET)
PostgreSQL: Windows service
```

Same code path as Vercel — only the scheduler and the TLS terminator differ.
The public domain lives in `NEXT_PUBLIC_APP_URL`/`AUTH_URL` (or the
`tracking.domain` setting, which wins at runtime), so links keep working
across restarts as long as the ngrok domain is reserved.

## 11. UI system

Dark, premium SaaS aesthetic via Tailwind tokens (`ink` surfaces, `ember`
accent, `shadow-card/pop`) and CSS primitives (`.card`, `.input`,
`.btn-primary/secondary/ghost`, `.table-base`, `.num`). Shared components:
`PageHeader`, `Card`, `StatCard`, `Badge`, `EmptyState`,
`FeatureDisabledNotice`, `ToggleSwitch`, `ConfirmAction` (accessible modal),
`ToastProvider` (aria-live), `Sidebar` (sectioned nav, flag-gated), Recharts
wrappers in `charts.tsx` with a CVD-validated palette. Every list has an
empty state; every destructive action confirms; every async action toasts.
