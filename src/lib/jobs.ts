import { prisma } from "@/lib/prisma";
import { apifyEnabled, getLastRawItemSample, scrapeAndStoreThreadMetrics } from "@/lib/apify";
import { computeLeaderboards } from "@/lib/leaderboard";

/**
 * Background job implementations. Invoked by:
 *  - /api/cron/refresh-metrics  (every 6 hours — vercel.json / external cron)
 *  - /api/cron/leaderboard      (every 10 minutes)
 *  - scripts/jobs-dev.ts        (local development scheduler)
 */

export type RefreshResult = {
  scraped: number;
  failed: number;
  skipped: number;
  apify: boolean;
  /** Per-thread actor error messages (capped) so failures are diagnosable from the JobRun. */
  errors?: { threadId: string; error: string }[];
  /** Raw first item of the last scrape (capped ~4 KB) — the actual actor
   *  output shape, inspectable from Admin → Debug without shell access. */
  sampleItem?: string;
};

/** Re-scrapes metrics for every thread of a non-draft campaign. */
export async function runMetricsRefresh(): Promise<RefreshResult> {
  if (!(await apifyEnabled())) {
    return { scraped: 0, failed: 0, skipped: 0, apify: false };
  }

  const threads = await prisma.thread.findMany({
    where: { campaign: { status: { in: ["ACTIVE", "PAUSED"] } } },
    orderBy: { postedAt: "asc" },
  });

  let scraped = 0;
  const errors: { threadId: string; error: string }[] = [];

  // Sequential on purpose: avoids hammering the Apify actor with parallel runs.
  for (const thread of threads) {
    try {
      await scrapeAndStoreThreadMetrics(thread);
      scraped++;
    } catch (err) {
      console.error(`[jobs] scrape failed for thread ${thread.id}`, err);
      if (errors.length < 10) {
        errors.push({
          threadId: thread.id,
          error: err instanceof Error ? err.message.slice(0, 300) : "Unknown error",
        });
      }
    }
  }

  const failed = threads.length - scraped;
  const sampleItem = getLastRawItemSample();
  return {
    scraped,
    failed,
    skipped: 0,
    apify: true,
    ...(failed > 0 ? { errors } : {}),
    ...(sampleItem ? { sampleItem } : {}),
  };
}

export async function runLeaderboardRefresh() {
  return computeLeaderboards();
}

/** Cron endpoints are protected by a shared secret. */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  // Vercel Cron sends the secret configured in the project automatically.
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}
