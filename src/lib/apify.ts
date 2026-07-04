import { prisma } from "@/lib/prisma";
import { getIntegrationConfig, getIntegrationCredential } from "@/lib/integrations";
import { getProxyFor, proxyUrl } from "@/lib/proxies";
import { decryptSecret } from "@/lib/crypto";

export type ScrapedMetrics = {
  views: number;
  likes: number;
  replies: number;
  retweets: number;
  quotes: number;
  text: string | null;
};

const APIFY_BASE = "https://api.apify.com/v2";

/**
 * Credentials resolve from the Apify Integration record first (managed
 * in Admin → Integrations), falling back to env vars so existing
 * deployments keep working unchanged.
 */
async function resolveApify(): Promise<{ token: string; actorId: string } | null> {
  const [credential, config] = await Promise.all([
    getIntegrationCredential("apify"),
    getIntegrationConfig("apify"),
  ]);
  const token = credential ?? process.env.APIFY_TOKEN;
  if (!token) return null;
  const actorId = config.actorId || process.env.APIFY_ACTOR_ID || "goat255~twitter-tweet-scraper";
  return { token, actorId };
}

export async function apifyEnabled(): Promise<boolean> {
  return (await resolveApify()) !== null;
}

/**
 * Coerces one candidate to a count, tolerating every value form actors
 * have been seen to emit:
 *   27077            plain number
 *   "27077"          numeric string
 *   "27,077"         thousands separators (commas/spaces)
 *   "27.1K" / "1.2M" magnitude suffixes (K/M/B, case-insensitive)
 *   { count: "27077" }  Twitter GraphQL views object
 * Returns null (not 0) when the value is unparseable so num() can try the
 * next alias — likes arriving as numbers while views arrive as display
 * strings is exactly the bug class this guards against.
 */
function toCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s]/g, "");
    if (cleaned === "") return null;
    const suffix = cleaned.slice(-1).toUpperCase();
    const multiplier = suffix === "K" ? 1e3 : suffix === "M" ? 1e6 : suffix === "B" ? 1e9 : 1;
    const numeric = Number(multiplier === 1 ? cleaned : cleaned.slice(0, -1));
    if (Number.isFinite(numeric)) return Math.max(0, Math.round(numeric * multiplier));
    return null;
  }
  if (value && typeof value === "object" && "count" in value) {
    return toCount((value as { count: unknown }).count);
  }
  return null;
}

function num(...candidates: unknown[]): number {
  for (const c of candidates) {
    const n = toCount(c);
    if (n !== null) return n;
  }
  return 0;
}

/** Resolves dotted paths ("public_metrics.impression_count") against an item. */
function pick(item: Record<string, unknown>, paths: readonly string[]): unknown[] {
  return paths.map((path) =>
    path.split(".").reduce<unknown>(
      (cur, key) =>
        cur && typeof cur === "object" ? (cur as Record<string, unknown>)[key] : undefined,
      item,
    ),
  );
}

/**
 * Alias precedence per metric — first parseable value wins. Order:
 * the current actor's nested `metrics.*`, then flat names, then the
 * camelCase/snake_case/public_metrics/legacy shapes of older scrapers.
 * Keep old aliases forever: an actor version bump must degrade to a
 * fallback, never to silent zeros.
 */
const METRIC_PATHS = {
  views: [
    "metrics.views",
    "views",
    "viewCount",
    "viewsCount",
    "view_count",
    "views_count",
    "impressions",
    "impressionCount",
    "impression_count",
    "public_metrics.impression_count",
    "viewCountString",
    "views.count",
    "legacy.views.count",
  ],
  likes: [
    "metrics.likes",
    "likes",
    "likeCount",
    "likesCount",
    "favoriteCount",
    "favorite_count",
    "public_metrics.like_count",
    "legacy.favorite_count",
  ],
  replies: [
    "metrics.replies",
    "replies",
    "replyCount",
    "repliesCount",
    "reply_count",
    "replies_count",
    "public_metrics.reply_count",
    "legacy.reply_count",
  ],
  retweets: [
    "metrics.retweets",
    "retweets",
    "retweetCount",
    "retweetsCount",
    "retweet_count",
    "retweets_count",
    "public_metrics.retweet_count",
    "legacy.retweet_count",
  ],
  quotes: [
    "metrics.quotes",
    "quotes",
    "quoteCount",
    "quotesCount",
    "quote_count",
    "quotes_count",
    "public_metrics.quote_count",
    "legacy.quote_count",
  ],
} as const;

// Raw first item of the most recent scrape (capped) — logged server-side
// and attached to the metrics-refresh JobRun so the actual actor output
// shape is inspectable from Admin → Debug without shell access.
const SAMPLE_CAP_BYTES = 4096;
let lastRawItemSample: string | null = null;

export function getLastRawItemSample(): string | null {
  return lastRawItemSample;
}

function str(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() !== "") return c;
  }
  return null;
}

/**
 * Runs the Apify actor (default: goat255/twitter-tweet-scraper) synchronously
 * and returns the metrics of the scraped tweet.
 *
 * Actor output field names vary between scraper versions, so extraction is
 * defensive: several known aliases are checked for each metric.
 */
export async function scrapeTweet(twitterUrl: string, tweetId: string): Promise<ScrapedMetrics> {
  const apify = await resolveApify();
  if (!apify) throw new ApifyError("Apify is not configured (Admin → Integrations or APIFY_TOKEN)");

  const endpoint = `${APIFY_BASE}/acts/${encodeURIComponent(apify.actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(apify.token)}`;

  // If an outbound proxy is assigned to the "apify" service, the actor
  // receives it as a custom proxy URL (actor-side scraping traffic).
  const assignedProxy = await getProxyFor("apify");
  const proxyConfiguration =
    assignedProxy != null
      ? {
          useApifyProxy: false,
          proxyUrls: [
            proxyUrl({
              ...assignedProxy,
              passwordPlain: assignedProxy.passwordEncrypted
                ? decryptSecret(assignedProxy.passwordEncrypted)
                : null,
            }),
          ],
        }
      : undefined;

  // goat255/twitter-tweet-scraper input contract: it requires at least one
  // entry in "usernames" or "tweetUrls"; we always scrape one exact tweet.
  const input = {
    tweetUrls: [twitterUrl],
    ...(proxyConfiguration ? { proxyConfiguration } : {}),
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Apify errors are JSON: {"error":{"type":"...","message":"..."}} —
    // surface the actor's own message so admins see the real cause.
    let detail = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: { type?: string; message?: string } };
      if (parsed.error?.message) {
        detail = parsed.error.type
          ? `${parsed.error.type}: ${parsed.error.message}`
          : parsed.error.message;
      }
    } catch {
      // non-JSON body — keep the raw excerpt
    }
    throw new ApifyError(`Apify actor error (HTTP ${res.status}) — ${detail}`);
  }

  const items = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApifyError(
      "Apify run succeeded but returned no items — the tweet may be deleted, private, or not yet indexed",
    );
  }

  // Prefer the item matching our tweet id, otherwise take the first.
  const item =
    items.find((i) => {
      const id = str(i.id, i.id_str, i.tweetId, i.tweet_id, i.rest_id);
      return id === tweetId;
    }) ?? items[0];

  // Diagnostic sample: public tweet data only — the token never appears in
  // item payloads. Capped so JobRun rows stay small.
  try {
    lastRawItemSample = JSON.stringify(item).slice(0, SAMPLE_CAP_BYTES);
    console.log("[apify] raw item sample:", lastRawItemSample);
  } catch {
    lastRawItemSample = null;
  }

  const legacy = (item.legacy ?? {}) as Record<string, unknown>;

  const result: ScrapedMetrics = {
    views: num(...pick(item, METRIC_PATHS.views)),
    likes: num(...pick(item, METRIC_PATHS.likes)),
    replies: num(...pick(item, METRIC_PATHS.replies)),
    retweets: num(...pick(item, METRIC_PATHS.retweets)),
    quotes: num(...pick(item, METRIC_PATHS.quotes)),
    text: str(item.text, item.fullText, item.full_text, legacy.full_text),
  };

  // All-zero on a "successful" scrape is the silent failure mode this
  // parser exists to prevent — make it loud (in logs, never for visitors).
  if (
    result.views + result.likes + result.replies + result.retweets + result.quotes === 0
  ) {
    console.warn(
      "[apify] every metric parsed as 0 — the actor output shape may have changed. Sample:",
      lastRawItemSample,
    );
  }

  return result;
}

/**
 * Scrapes a thread and appends a ThreadMetrics snapshot.
 * Also backfills Thread.text on first successful scrape.
 */
export async function scrapeAndStoreThreadMetrics(thread: {
  id: string;
  twitterUrl: string;
  twitterId: string;
  text: string;
}) {
  const metrics = await scrapeTweet(thread.twitterUrl, thread.twitterId);

  const [snapshot] = await prisma.$transaction([
    prisma.threadMetrics.create({
      data: {
        threadId: thread.id,
        views: metrics.views,
        likes: metrics.likes,
        replies: metrics.replies,
        retweets: metrics.retweets,
        quotes: metrics.quotes,
      },
    }),
    ...(metrics.text && !thread.text
      ? [prisma.thread.update({ where: { id: thread.id }, data: { text: metrics.text } })]
      : []),
  ]);

  return snapshot;
}

export class ApifyError extends Error {}
