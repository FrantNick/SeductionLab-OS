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
    },
    orderBy: { postedAt: "desc" },
  });

  return threads.map((t) => {
    const m = t.metrics[0];
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
      views: m?.views ?? 0,
      likes: m?.likes ?? 0,
      replies: m?.replies ?? 0,
      retweets: m?.retweets ?? 0,
      quotes: m?.quotes ?? 0,
      scrapedAt: m?.scrapedAt ?? null,
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
  ctr: number;
};

/**
 * Ranks threads by views, CTR or revenue.
 *
 * Clicks and revenue are recorded per (affiliate, campaign) — not per thread —
 * so they are attributed to an affiliate's threads within a campaign
 * proportionally to each thread's share of views (evenly when views are 0).
 */
export async function getTopThreads(options: {
  by: "views" | "ctr" | "revenue";
  limit?: number;
  affiliateId?: string;
  campaignId?: string;
}): Promise<RankedThread[]> {
  const { by, limit = 10, affiliateId, campaignId } = options;

  const [threads, clicksBy, convsBy] = await Promise.all([
    getThreadsWithLatestMetrics({ affiliateId, campaignId }),
    prisma.click.groupBy({
      by: ["affiliateId", "campaignId"],
      where: { affiliateId, campaignId },
      _count: { _all: true },
    }),
    prisma.conversion.groupBy({
      by: ["affiliateId", "campaignId"],
      where: { affiliateId, campaignId },
      _sum: { revenue: true },
    }),
  ]);

  const cellKey = (a: string, c: string) => `${a}:${c}`;
  const clickMap = new Map(clicksBy.map((c) => [cellKey(c.affiliateId, c.campaignId), c._count._all]));
  const revMap = new Map(
    convsBy.map((c) => [cellKey(c.affiliateId, c.campaignId), Number(c._sum.revenue ?? 0)]),
  );

  const cellViews = new Map<string, { views: number; count: number }>();
  for (const t of threads) {
    const key = cellKey(t.affiliateId, t.campaignId);
    const cur = cellViews.get(key) ?? { views: 0, count: 0 };
    cur.views += t.views;
    cur.count += 1;
    cellViews.set(key, cur);
  }

  const ranked: RankedThread[] = threads.map((t) => {
    const key = cellKey(t.affiliateId, t.campaignId);
    const cell = cellViews.get(key)!;
    const share = cell.views > 0 ? t.views / cell.views : 1 / cell.count;
    const attributedClicks = Math.round((clickMap.get(key) ?? 0) * share);
    const attributedRevenue = (revMap.get(key) ?? 0) * share;
    return {
      ...t,
      attributedClicks,
      attributedRevenue,
      ctr: t.views > 0 ? attributedClicks / t.views : 0,
    };
  });

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
