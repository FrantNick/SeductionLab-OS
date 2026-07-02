import { prisma } from "@/lib/prisma";

export type ScrapedMetrics = {
  views: number;
  likes: number;
  replies: number;
  retweets: number;
  quotes: number;
  text: string | null;
};

const APIFY_BASE = "https://api.apify.com/v2";

export function apifyEnabled(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
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
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new ApifyError("APIFY_TOKEN is not configured");

  const actorId = process.env.APIFY_ACTOR_ID ?? "goat255~twitter-tweet-scraper";
  const endpoint = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  const input = {
    // Cover the common input shapes accepted by tweet-scraper actors.
    tweetIDs: [tweetId],
    tweet_ids: [tweetId],
    urls: [twitterUrl],
    startUrls: [{ url: twitterUrl }],
    maxItems: 1,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApifyError(`Apify run failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const items = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApifyError("Apify returned no items for this tweet");
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
