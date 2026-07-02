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

function num(...candidates: unknown[]): number {
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return Math.max(0, Math.round(c));
    if (typeof c === "string" && c.trim() !== "" && !Number.isNaN(Number(c))) {
      return Math.max(0, Math.round(Number(c)));
    }
  }
  return 0;
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

  const legacy = (item.legacy ?? {}) as Record<string, unknown>;

  return {
    views: num(
      item.viewCount,
      item.views,
      item.view_count,
      item.impressions,
      (item.views as Record<string, unknown> | undefined)?.count,
    ),
    likes: num(item.likeCount, item.likes, item.favorite_count, legacy.favorite_count),
    replies: num(item.replyCount, item.replies, item.reply_count, legacy.reply_count),
    retweets: num(item.retweetCount, item.retweets, item.retweet_count, legacy.retweet_count),
    quotes: num(item.quoteCount, item.quotes, item.quote_count, legacy.quote_count),
    text: str(item.text, item.fullText, item.full_text, legacy.full_text),
  };
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
