# Seduction Lab OS — Roadmap

Ranked by business impact within each phase. Every item builds on existing
foundations (noted inline) — no rewrites required.

## V1.1 — Close the revenue loop (highest impact)

1. **Webhook conversion attribution (Stripe/Gumroad/Shopify).**
   The single biggest gap between "tracking clicks" and "proving ROI".
   Foundations ready: `Conversion.sourceClickId`, `ref={slug}` on every
   checkout URL, Integration credential store with validators. Work: webhook
   endpoints + signature verification, click lookup by ref/recency, dedup.
2. **Automated regression tests.** The manual checklist in HANDOFF.md as
   Playwright + a unit layer for `analytics`, `leaderboard`, `tracking`,
   `crypto`. Protects everything else on this list.
3. **Payout accounting.** Commission rate per campaign, payout statements per
   affiliate per period, CSV export. Pure read-model over `Conversion`.
4. **Click anti-fraud heuristics.** Dedup by ipHash+UA window, bot UA filter,
   flag outlier CTRs. `Click` already stores everything needed.
5. **Affiliate onboarding polish.** Invite links, email verification,
   password reset (needs a mail provider integration — reuse the
   Integration registry).

## V2 — Intelligence layer

1. **AI thread writer + hook generator in the affiliate UI.** Feature configs,
   prompts and adapters exist; add the affiliate-facing generation flows with
   human-in-the-loop editing (never auto-post).
2. **Thread grading & daily summaries as jobs.** Write `AiInsight` rows from
   scheduled jobs (`JOB_DEFS` registry makes new jobs one-line registrations);
   surface grades on thread pages and a daily digest notification.
3. **Embedding-based knowledge retrieval.** Fill `KnowledgeChunk.embedding`
   (pgvector), swap ranking inside `searchKnowledge()` — signature stays.
4. **Experiment analytics.** Significance hints (sample sizes, conversion
   deltas), auto-suggested winners; `experiment-planner` feature proposes
   next tests from real data.
5. **AI chat for affiliates.** Same `runAssistantTurn` scoped to the
   affiliate's own data (context builder parameterized by affiliateId).

## V2.x — Scale & operations

1. **Queue-based metric ingestion.** Replace sequential cron scraping with a
   job queue + concurrency + per-provider rate budgets; `JobRun` stays the
   observability layer.
2. **Multi-tenancy.** Workspace/organization model above `User`; every table
   gains a tenant key. Do this before external customers, not after.
3. **Additional metric providers.** X official API tier as a first-class
   alternative to Apify behind the same `ThreadMetrics` writer.
4. **Notification channels.** Email/Discord webhooks for rank changes,
   experiment results, job failures (preferences already stored on
   `Affiliate.notificationPrefs`).
5. **Tracking-domain multiplexing.** Multiple custom domains with per-campaign
   assignment; `tracking.domain` setting becomes a table.

## V3 — Platform

1. **Self-serve affiliate marketplace.** Public campaign directory,
   application/approval workflow on top of `CampaignAssignment` statuses.
2. **Revenue-share automation.** Payout execution via payment integrations
   (building on V1.1 payout accounting).
3. **Multi-channel attribution.** Beyond X: TikTok/YouTube/newsletter link
   tracking — `Thread` generalizes to `Post` with a `channel` discriminator.
4. **Public API + API keys.** Expose tracking/analytics endpoints for
   customers' own dashboards; scoped keys, rate limits, audit trail.
5. **White-labeling.** Branding settings already exist; add per-tenant themes
   and custom login domains once multi-tenancy lands.

## Deliberately not planned

- Auto-posting to social platforms (ToS risk; humans post, we measure).
- Scraping outside official/licensed APIs, or any block-evasion tooling.
- Raw IP storage or fingerprinting beyond salted hashes.
