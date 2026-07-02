# Seduction Lab OS — Technical Handoff

Multi-tenant-style SaaS for affiliate marketing attribution and
experimentation: admins define products and campaigns, affiliates promote via
X (Twitter) threads, the platform attributes clicks and revenue back to each
affiliate and ranks them on cached leaderboards. V2 adds the platform layer:
notifications, settings, feature flags, audit logs, job runs, AI
infrastructure, integrations, proxies and experiments.

**Stack:** Next.js 15 App Router (TypeScript, React 19) · PostgreSQL + Prisma 6
· Auth.js v5 (credentials, JWT) · Tailwind CSS · Recharts · Apify (thread
metrics).

---

## 1. Running the project

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, AUTH_SECRET, …
npm run db:migrate        # prisma migrate dev
npm run db:seed           # admin + platform defaults (+ demo data)
npm run dev               # app on :3000
npm run jobs:dev          # local cron scheduler
```

Checks (all must pass before merging):

```bash
npm run typecheck && npm run lint && npm run build
```

Seeded logins: `admin@seduction-lab.com` / `admin12345` (admin),
`maya@example.com` / `affiliate123` (affiliate). Override with `SEED_*` env
vars; `SEED_DEMO_DATA=false` seeds only the admin + platform defaults.

## 2. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | Auth.js JWT signing secret |
| `AUTH_TRUST_HOST` | prod | set `true` behind a proxy/Vercel |
| `NEXT_PUBLIC_APP_URL` | yes | public app origin |
| `TRACKING_DOMAIN` | no | dedicated tracking-link origin (falls back to app URL; DB setting `tracking.domain` overrides both) |
| `IP_HASH_SALT` | yes | salt for click IP hashing — never store raw IPs |
| `ENCRYPTION_KEY` | recommended | AES-256-GCM key for secrets at rest (falls back to `AUTH_SECRET`) |
| `CRON_SECRET` | yes | shared secret protecting `/api/cron/*` |
| `APIFY_TOKEN`, `APIFY_ACTOR_ID` | no | env fallback for the Apify integration (DB integration takes precedence) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_DEMO_DATA` | no | seeding |

## 3. Folder map

```
prisma/
  schema.prisma        # full data model, V1 core + V2 platform (comments inline)
  migrations/          # 20260702070207_init (V1), 20260702105103_v2_foundation (V2)
  seed.ts              # admin, platform defaults (flags/prompts/AI configs), demo data
scripts/jobs-dev.ts    # local scheduler hitting the cron endpoints
src/
  middleware.ts        # session gate + role routing (/admin admins-only)
  app/
    (auth)/            # login, register
    go/[slug]/         # public tracking redirect (Click logging)
    dashboard/         # affiliate area (overview, campaigns, threads, links,
                       #   leaderboard, settings)
    admin/             # admin area (overview, campaigns, affiliates, products,
                       #   conversions, analytics, leaderboard, experiments,
                       #   ai [+prompts/knowledge/chat], integrations, proxies,
                       #   audit, settings, debug) — each with actions.ts
    api/               # REST-ish routes (see §6)
  components/          # shared UI (ui.tsx primitives, charts, toast, dialogs,
                       #   sidebar, ai-chat, forms)
  hooks/use-clipboard.ts
  lib/                 # ALL business logic lives here (see §4)
  types/next-auth.d.ts # session shape (role, affiliateId)
```

Conventions:

- **Server components + server actions** for admin CRUD; client components
  only where interactivity demands it (toasts, chat, clipboard, forms with
  fetch). Actions all start with `requireAdmin()` / `requireAffiliate()`.
- **`src/lib` is the only place business logic lives.** Pages orchestrate and
  render; API routes validate and delegate.
- Client code talks to APIs through `lib/api-client.ts` (`api.get/post/…`,
  typed, uniform errors) — never raw `fetch` in components.

## 4. Library layer (src/lib)

| Module | Responsibility |
|---|---|
| `auth.ts`, `auth.config.ts` | Auth.js setup, `requireSession/requireAdmin/requireAffiliate` |
| `prisma.ts` | singleton client |
| `api.ts` | `withErrorHandling` wrapper + `jsonError` for routes |
| `api-client.ts` | shared typed client-side fetch helper |
| `crypto.ts` | AES-256-GCM `encryptSecret`/`decryptSecret` (key: `ENCRYPTION_KEY`) |
| `tracking.ts` | slug generation, destination URL building, IP hashing |
| `twitter.ts` | thread URL/id parsing |
| `apify.ts` | Apify actor calls; credentials resolve DB-integration-first, env-fallback |
| `analytics.ts` | global/campaign/thread aggregations (CTR, CVR, revenue) |
| `analytics-periods.ts` | today/yesterday/7d/30d stat windows, per-day series, activity feed |
| `leaderboard.ts` | cached rankings (global + per campaign), movement tracking |
| `jobs.ts`, `job-runs.ts` | job implementations + JobRun recording, `JOB_DEFS` registry |
| `notifications.ts` | persistent in-app notifications (`notify`, `notifyAffiliate`) |
| `feature-flags.ts` | `FLAG_DEFS` registry + DB overlay (`ai`, `experiments`, `integrations`, `proxies`, `beta`) |
| `app-settings.ts` | `SETTING_DEFS` registry + DB overlay (branding, tracking domain, defaults) |
| `audit.ts` | typed `logAudit` (action union type — extend it when adding actions) |
| `integrations.ts` | `INTEGRATION_DEFS` registry (credential label, config fields, live validators) |
| `proxies.ts` | TCP health checks, `getProxyFor(service)`, `PROXY_SERVICES` |
| `experiments.ts` | experiment metrics scoped to window + cohort |
| `ai/registry.ts` | provider presets, `AI_FEATURES`, `DEFAULT_PROMPTS` (no runtime deps) |
| `ai/adapters.ts` | wire-format adapters (OpenAI-compatible, Anthropic) + credential validation |
| `ai/service.ts` | feature → config → provider resolution, `runAssistantTurn`, `ensureAiFeatureConfigs` |
| `ai/prompts.ts` | versioned prompts (create/version/activate/render) |
| `ai/knowledge.ts` | document chunking + ingestion |
| `ai/context.ts` | live platform snapshot + keyword retrieval over chunks |

## 5. Data model (prisma/schema.prisma)

**V1 core (unchanged):** `User` 1–1 `Affiliate`; `Product` → `Campaign` →
(`Thread`, `TrackingLink`, `Click`, `Conversion`, `CampaignAssignment`,
`LeaderboardEntry`). Every `Click` stores `trackingLinkId + affiliateId +
campaignId` — attribution is denormalized on purpose so no join can lose it.
`ThreadMetrics` is append-only (one row per scrape; latest = current, history
= charts). `Conversion.sourceClickId` is the ready-made hook for webhook
attribution.

**V2 platform:** `Notification`, `AppSetting`, `FeatureFlag`, `AuditLog`,
`JobRun`, `AiProvider`, `AiModelConfig` (one per feature), `Prompt` +
`PromptVersion` (active-pointer versioning), `AiConversation`/`AiMessage`,
`KnowledgeDocument`/`KnowledgeChunk` (embedding column reserved), `AiInsight`,
`Proxy`/`ProxyAssignment`, `Integration`, `Experiment`/`ExperimentAssignment`.

Migrations are additive; V2 never altered V1 semantics.

## 6. API routes

| Route | Auth | Purpose |
|---|---|---|
| `GET /go/[slug]` | public | log Click (hashed IP, UA, country) → 302 to checkout |
| `POST /api/register` | public | affiliate self-signup |
| `POST /api/tracking/generate` | affiliate | idempotent link per affiliate×campaign×product |
| `GET/POST /api/threads` | affiliate | list / submit threads (+ initial scrape) |
| `POST /api/apify/scrape-thread` | owner/admin | manual metrics refresh for one thread |
| `POST /api/conversions/manual` | admin | manual revenue entry |
| `GET/POST /api/notifications` | session | list / mark-all-read |
| `GET/POST /api/admin/jobs` | admin | job status / manual trigger (audited) |
| `POST /api/ai/chat` | session + `ai` flag | one assistant turn; 503 when unconfigured |
| `POST /api/ai/knowledge` | admin | ingest document (multipart file or JSON) |
| `GET/POST /api/cron/leaderboard` | `CRON_SECRET` | recompute leaderboards (10 min) |
| `GET/POST /api/cron/refresh-metrics` | `CRON_SECRET` | re-scrape thread metrics (6 h) |

Server actions (in `app/**/actions.ts`) cover all admin CRUD: products,
campaigns, assignments, affiliates, experiments, AI providers/configs/prompts,
knowledge deletion, integrations, proxies, settings, flags, debug link
generation, plus affiliate profile/password/notification-prefs updates.

## 7. Auth & authorization

- Credentials login (bcrypt, cost 12); JWT session carries `role` and
  `affiliateId` (see `types/next-auth.d.ts`).
- `middleware.ts`: unauthenticated → `/login`; affiliates never reach
  `/admin`; admins may browse `/dashboard`.
- Defense in depth: every server action and API route re-checks
  (`requireAdmin` etc.) — middleware is a convenience, not the boundary.
- BANNED affiliates cannot log in (checked in `authorize`).

## 8. Core pipelines

**Tracking:** affiliate generates link → `/go/{slug}` logs Click with salted
SHA-256 IP hash (never raw IPs), UA, geo country header if the host provides
it → 302 to `destinationUrl` (checkout + UTM + `ref={slug}`).

**Threads/metrics:** affiliate submits thread URL → parsed/validated, stored
once per (affiliate, tweet) → Apify scrape appends `ThreadMetrics` snapshots
(initial + every 6 h + manual refresh). Without Apify configured the platform
says "not configured" — it never fabricates metrics.

**Revenue:** manual `Conversion` entry (admin) with full attribution;
`sourceClickId` optional. Webhook attribution lands in V2.1 (see ROADMAP).

**Leaderboards:** `computeLeaderboards()` rewrites `LeaderboardEntry` per
scope (global + each campaign) ranked revenue → clicks → views, carrying
`previousRank` forward for movement badges. Reads hit the cache only (one
lazy compute on empty cache).

**Analytics definitions:** CTR = clicks ÷ views, CVR = conversions ÷ clicks;
per-thread revenue is attributed proportionally to view share (documented in
`analytics.ts`).

## 9. Background jobs

`JOB_DEFS` (lib/job-runs.ts) registers `leaderboard` (10 min) and
`refresh-metrics` (6 h). Every execution — cron, manual, API — creates a
`JobRun` row (status/trigger/result/error) powering the debug panel, settings
status and health checks. Production scheduling: `vercel.json` cron (or any
scheduler hitting `/api/cron/*` with the secret). Local: `npm run jobs:dev`.

## 10. AI infrastructure

Resolution chain (all DB-driven, nothing hardcoded):
`feature → AiModelConfig → AiProvider (encrypted key) → adapter`, with the
system prompt coming from the config's `Prompt` active version.

- **Providers:** presets for OpenAI, Anthropic, OpenRouter, Google, DeepSeek,
  Groq, Together, Fireworks, Ollama, LM Studio — but any OpenAI-compatible
  base URL works. Keys AES-256-GCM encrypted; live validation via `/models`.
- **Features:** 7 registered (`chat-assistant`, `thread-writer`,
  `thread-analyzer`, `reply-generator`, `hook-generator`,
  `experiment-planner`, `marketing-coach`). Each has provider/model/
  temperature/max-tokens/reasoning-level/prompt/enabled config in the UI.
  Only `chat-assistant` has a runtime path today; the rest are configured and
  awaiting their features (AiInsight table is ready for their output).
- **Prompts:** versioned, active-pointer rollback, categories, `{{variables}}`.
- **Knowledge base:** PDF/MD/text ingestion, chunking (1500/200 overlap),
  keyword retrieval now, `KnowledgeChunk.embedding` reserved for vectors.
- **Honesty rule:** unconfigured AI returns 503 and stores nothing. Never
  fake model output.

## 11. Integrations & proxies

`INTEGRATION_DEFS` registers Apify, Stripe, Shopify, Gumroad, OpenAI,
Anthropic, OpenRouter. Credentials encrypted; validators call the real API
where possible, otherwise status honestly reads "no live validation".
Consumers resolve credentials DB-first (`getIntegrationCredential`), env
fallback (Apify). Proxies exist for reliability/geo-routing of authorized
integration traffic only — TCP health checks, latency, success/failure
counters, per-service assignment (`apify`, `ai`). Not an anti-detection tool;
keep it that way.

## 12. Configuration & flags

- `AppSetting` (branding, tracking domain, currency, leaderboard size,
  metrics cadence) — registered defaults in `SETTING_DEFS`, editable under
  Admin → Settings, applied without redeploy (sidebar app name, tracking URLs).
- `FeatureFlag` (`ai`, `experiments`, `integrations`, `proxies`, `beta`) gate
  nav items, pages and APIs at runtime.

## 13. Testing checklist (manual, ~10 min)

1. Log in as admin → create product → create campaign (ACTIVE) → assign affiliate.
2. Log in as affiliate → campaigns page → generate + copy tracking link.
3. Open `/go/{slug}` in an incognito tab → verify 302 and a new click on the dashboard.
4. Submit a thread URL → thread stored; metrics show "scraping disabled" unless Apify configured.
5. Admin → Conversions → add manual conversion → affiliate revenue updates.
6. Admin → Overview → "Refresh leaderboards" → ranks + movement update everywhere.
7. Admin → AI → connect provider (real key) → validate → enable `chat-assistant` + model → Chat answers with live numbers. Without a key: chat shows "not configured".
8. Admin → Settings → toggle a flag off → nav item disappears, page shows disabled notice.
9. Admin → Debug → run all jobs → JobRuns recorded; Audit log shows every action from steps 1–8.
10. `npm run typecheck && npm run lint && npm run build` — all green.

## 14. Technical debt / known limitations

- `next lint` is deprecated (Next 16 removes it) — migrate to the ESLint CLI.
- `package.json#prisma.seed` config is deprecated in Prisma 7 — move to `prisma.config.ts`.
- Keyword-only knowledge retrieval until the embedding pipeline lands.
- Country geo on clicks depends on host-provided headers (works on Vercel; self-hosting needs a GeoIP layer).
- Reasoning-level config is stored but not yet mapped to provider-specific
  parameters in the adapters.
- No automated test suite yet — the checklist above is the regression gate
  (highest-leverage next investment; see ROADMAP).
- Sequential Apify scraping is deliberate (rate-limit friendly) but slow for
  large thread counts; queue + concurrency belongs to V2.x.

## 15. Where to add things

- **New audited action:** extend the `AuditAction` union in `lib/audit.ts` first — the compiler then guides you.
- **New AI feature:** add to `AI_FEATURES` (+ default prompt in `DEFAULT_PROMPTS`); config UI, seeding and resolution come free. Implement its runtime path via `resolveFeature("your-feature")`.
- **New integration:** add an `INTEGRATION_DEFS` entry (with a validator if the API allows) — the Integrations UI renders it automatically.
- **New job:** implement in `lib/jobs.ts`, register in `JOB_DEFS` — debug panel, status views and `run all` pick it up.
- **New setting/flag:** register in `SETTING_DEFS` / `FLAG_DEFS`; UI follows.
