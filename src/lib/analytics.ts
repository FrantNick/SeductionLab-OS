import { prisma } from "@/lib/prisma";

/**
 * Analytics layer. All numbers are computed from the DB (source of truth):
 *  - views come from the latest ThreadMetrics snapshot of each thread
 *  - clicks come from the Click log
 *  - revenue comes from Conversions (manually entered in V1)
 *
 * CTR  = clicks / views
 * CVR  = conversions / clicks
 */

/**
 * Exact per-link conversion totals: a conversion belongs to a link when
 * its sourceClick came through that link. Manual conversions entered
 * without a source click are (correctly) not attributable to any link.
 */
export async function getConversionsByLink(
  linkIds: string[],
): Promise<Map<string, { count: number; revenue: number }>> {
  const byLink = new Map<string, { count: number; revenue: number }>();
  if (linkIds.length === 0) return byLink;

  const rows = await prisma.conversion.findMany({
    where: { sourceClick: { trackingLinkId: { in: linkIds } } },
    select: { revenue: true, sourceClick: { select: { trackingLinkId: true } } },
  });
  for (const c of rows) {
    const linkId = c.sourceClick!.trackingLinkId;
    const cur = byLink.get(linkId) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number(c.revenue);
    byLink.set(linkId, cur);
  }
  return byLink;
}

export type ThreadWithLatest = {
  id: string;
  affiliateId: string;
  campaignId: string;
  twitterUrl: string;
  twitterId: string;
  text: string;
  postedAt: Date;
  affiliateName: string;
  campaignName: string;
  views: number;
  likes: number;
  replies: number;
  retweets: number;
  quotes: number;
  scrapedAt: Date | null;
  /** The thread's bound tracking link — null only for pre-migration threads. */
  linkId: string | null;
  linkSlug: string | null;
  /** Exact: clicks on this thread's own tracking link. */
  clicks: number;
  /** Exact: conversions whose source click came through this thread's link. */
  conversions: number;
  revenue: number;
  ctr: number;
};

export async function getThreadsWithLatestMetrics(where?: {
  affiliateId?: string;
  campaignId?: string;
}): Promise<ThreadWithLatest[]> {
  const threads = await prisma.thread.findMany({
    where,
    include: {
      affiliate: { select: { displayName: true } },
      campaign: { select: { name: true } },
      metrics: { orderBy: { scrapedAt: "desc" }, take: 1 },
      trackingLink: { select: { id: true, slug: true, _count: { select: { clicks: true } } } },
    },
    orderBy: { postedAt: "desc" },
  });

  // Conversions attribute to a thread through its link's clicks
  // (Conversion → sourceClick → TrackingLink → Thread). Manual conversions
  // without a source click stay campaign/affiliate-level by design.
  const linkIds = threads.flatMap((t) => (t.trackingLink ? [t.trackingLink.id] : []));
  const convByLink = await getConversionsByLink(linkIds);

  return threads.map((t) => {
    const m = t.metrics[0];
    const views = m?.views ?? 0;
    const clicks = t.trackingLink?._count.clicks ?? 0;
    const conv = t.trackingLink ? (convByLink.get(t.trackingLink.id) ?? null) : null;
    return {
      id: t.id,
      affiliateId: t.affiliateId,
      campaignId: t.campaignId,
      twitterUrl: t.twitterUrl,
      twitterId: t.twitterId,
      text: t.text,
      postedAt: t.postedAt,
      affiliateName: t.affiliate.displayName,
      campaignName: t.campaign.name,
      views,
      likes: m?.likes ?? 0,
      replies: m?.replies ?? 0,
      retweets: m?.retweets ?? 0,
      quotes: m?.quotes ?? 0,
      scrapedAt: m?.scrapedAt ?? null,
      linkId: t.trackingLink?.id ?? null,
      linkSlug: t.trackingLink?.slug ?? null,
      clicks,
      conversions: conv?.count ?? 0,
      revenue: conv?.revenue ?? 0,
      ctr: views > 0 ? clicks / views : 0,
    };
  });
}

export type CampaignStats = {
  campaignId: string;
  campaignName: string;
  status: string;
  productName: string;
  affiliates: number;
  threads: number;
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cvr: number;
};

export async function getCampaignStats(): Promise<CampaignStats[]> {
  const [campaigns, clicksBy, convsBy, threads] = await Promise.all([
    prisma.campaign.findMany({
      include: {
        product: { select: { name: true } },
        _count: { select: { assignments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.click.groupBy({ by: ["campaignId"], _count: { _all: true } }),
    prisma.conversion.groupBy({
      by: ["campaignId"],
      _count: { _all: true },
      _sum: { revenue: true },
    }),
    getThreadsWithLatestMetrics(),
  ]);

  const clickMap = new Map(clicksBy.map((c) => [c.campaignId, c._count._all]));
  const convMap = new Map(
    convsBy.map((c) => [
      c.campaignId,
      { count: c._count._all, revenue: Number(c._sum.revenue ?? 0) },
    ]),
  );
  const viewMap = new Map<string, { views: number; threads: number }>();
  for (const t of threads) {
    const cur = viewMap.get(t.campaignId) ?? { views: 0, threads: 0 };
    cur.views += t.views;
    cur.threads += 1;
    viewMap.set(t.campaignId, cur);
  }

  return campaigns.map((c) => {
    const clicks = clickMap.get(c.id) ?? 0;
    const conv = convMap.get(c.id) ?? { count: 0, revenue: 0 };
    const tv = viewMap.get(c.id) ?? { views: 0, threads: 0 };
    return {
      campaignId: c.id,
      campaignName: c.name,
      status: c.status,
      productName: c.product.name,
      affiliates: c._count.assignments,
      threads: tv.threads,
      views: tv.views,
      clicks,
      conversions: conv.count,
      revenue: conv.revenue,
      ctr: tv.views > 0 ? clicks / tv.views : 0,
      cvr: clicks > 0 ? conv.count / clicks : 0,
    };
  });
}

export type AffiliateOverview = {
  clicks: number;
  views: number;
  threads: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cvr: number;
  activeCampaigns: number;
  trackingLinks: number;
};

export async function getAffiliateOverview(affiliateId: string): Promise<AffiliateOverview> {
  const [clicks, convAgg, threads, activeCampaigns, trackingLinks] = await Promise.all([
    prisma.click.count({ where: { affiliateId } }),
    prisma.conversion.aggregate({
      where: { affiliateId },
      _count: { _all: true },
      _sum: { revenue: true },
    }),
    getThreadsWithLatestMetrics({ affiliateId }),
    prisma.campaignAssignment.count({
      where: { affiliateId, status: "ACTIVE", campaign: { status: "ACTIVE" } },
    }),
    prisma.trackingLink.count({ where: { affiliateId } }),
  ]);

  const views = threads.reduce((sum, t) => sum + t.views, 0);
  const conversions = convAgg._count._all;
  const revenue = Number(convAgg._sum.revenue ?? 0);

  return {
    clicks,
    views,
    threads: threads.length,
    conversions,
    revenue,
    ctr: views > 0 ? clicks / views : 0,
    cvr: clicks > 0 ? conversions / clicks : 0,
    activeCampaigns,
    trackingLinks,
  };
}

export type GlobalStats = {
  affiliates: number;
  activeCampaigns: number;
  threads: number;
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cvr: number;
};

export async function getGlobalStats(): Promise<GlobalStats> {
  const [affiliates, activeCampaigns, clicks, convAgg, threads] = await Promise.all([
    prisma.affiliate.count({ where: { status: "ACTIVE" } }),
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
    prisma.click.count(),
    prisma.conversion.aggregate({ _count: { _all: true }, _sum: { revenue: true } }),
    getThreadsWithLatestMetrics(),
  ]);

  const views = threads.reduce((sum, t) => sum + t.views, 0);
  const conversions = convAgg._count._all;
  const revenue = Number(convAgg._sum.revenue ?? 0);

  return {
    affiliates,
    activeCampaigns,
    threads: threads.length,
    views,
    clicks,
    conversions,
    revenue,
    ctr: views > 0 ? clicks / views : 0,
    cvr: clicks > 0 ? conversions / clicks : 0,
  };
}

export type RankedThread = ThreadWithLatest & {
  attributedClicks: number;
  attributedRevenue: number;
};

/**
 * Ranks threads by views, CTR or revenue.
 *
 * Attribution is exact: each thread is bound 1:1 to a tracking link, so
 * its clicks are the link's clicks and its revenue is the sum of
 * conversions traced to that link's clicks. (Threads submitted before
 * per-thread links have no bound link and therefore rank with 0 clicks
 * until one is linked.)
 */
export async function getTopThreads(options: {
  by: "views" | "ctr" | "revenue";
  limit?: number;
  affiliateId?: string;
  campaignId?: string;
}): Promise<RankedThread[]> {
  const { by, limit = 10, affiliateId, campaignId } = options;

  const threads = await getThreadsWithLatestMetrics({ affiliateId, campaignId });

  const ranked: RankedThread[] = threads.map((t) => ({
    ...t,
    attributedClicks: t.clicks,
    attributedRevenue: t.revenue,
  }));

  ranked.sort((a, b) => {
    if (by === "views") return b.views - a.views;
    if (by === "ctr") return b.ctr - a.ctr;
    return b.attributedRevenue - a.attributedRevenue;
  });

  return ranked.slice(0, limit);
}

export type AffiliatePerformance = {
  affiliateId: string;
  displayName: string;
  status: string;
  threads: number;
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
};

/** Revenue per affiliate + supporting metrics (admin analytics + leaderboard input). */
export async function getAffiliatePerformance(): Promise<AffiliatePerformance[]> {
  const [affiliates, clicksBy, convsBy, threads] = await Promise.all([
    prisma.affiliate.findMany({ orderBy: { displayName: "asc" } }),
    prisma.click.groupBy({ by: ["affiliateId"], _count: { _all: true } }),
    prisma.conversion.groupBy({
      by: ["affiliateId"],
      _count: { _all: true },
      _sum: { revenue: true },
    }),
    getThreadsWithLatestMetrics(),
  ]);

  const clickMap = new Map(clicksBy.map((c) => [c.affiliateId, c._count._all]));
  const convMap = new Map(
    convsBy.map((c) => [
      c.affiliateId,
      { count: c._count._all, revenue: Number(c._sum.revenue ?? 0) },
    ]),
  );
  const threadMap = new Map<string, { views: number; count: number }>();
  for (const t of threads) {
    const cur = threadMap.get(t.affiliateId) ?? { views: 0, count: 0 };
    cur.views += t.views;
    cur.count += 1;
    threadMap.set(t.affiliateId, cur);
  }

  return affiliates.map((a) => {
    const clicks = clickMap.get(a.id) ?? 0;
    const conv = convMap.get(a.id) ?? { count: 0, revenue: 0 };
    const tv = threadMap.get(a.id) ?? { views: 0, count: 0 };
    return {
      affiliateId: a.id,
      displayName: a.displayName,
      status: a.status,
      threads: tv.count,
      views: tv.views,
      clicks,
      conversions: conv.count,
      revenue: conv.revenue,
      ctr: tv.views > 0 ? clicks / tv.views : 0,
    };
  });
}

/** Click counts per day for the last `days` days (charts). */
export async function getClicksPerDay(days: number, where?: { affiliateId?: string }) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const clicks = await prisma.click.findMany({
    where: { ...where, createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i <= days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    if (d > new Date()) break;
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const c of clicks) {
    const key = c.createdAt.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([date, count]) => ({ date, clicks: count }));
}
