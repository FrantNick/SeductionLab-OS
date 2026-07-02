import { prisma } from "@/lib/prisma";
import { getThreadsWithLatestMetrics } from "@/lib/analytics";

/**
 * Leaderboards are cached aggregations: the leaderboard job recomputes
 * LeaderboardEntry rows (global + per campaign) every 10 minutes.
 * Reads always hit the cache; if the cache is empty (fresh install) the
 * caller may trigger a compute via computeLeaderboards().
 *
 * Ranking order: revenue desc → clicks desc → views desc.
 */

type Aggregate = {
  affiliateId: string;
  clicks: number;
  views: number;
  threads: number;
  revenue: number;
};

function rankAggregates(rows: Aggregate[]): (Aggregate & { rank: number })[] {
  const sorted = [...rows].sort(
    (a, b) => b.revenue - a.revenue || b.clicks - a.clicks || b.views - a.views,
  );
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}

async function aggregateFor(campaignId: string | null): Promise<Aggregate[]> {
  const clickWhere = campaignId ? { campaignId } : {};
  const [clicksBy, convsBy, threads, affiliates] = await Promise.all([
    prisma.click.groupBy({ by: ["affiliateId"], where: clickWhere, _count: { _all: true } }),
    prisma.conversion.groupBy({
      by: ["affiliateId"],
      where: clickWhere,
      _sum: { revenue: true },
    }),
    getThreadsWithLatestMetrics(campaignId ? { campaignId } : undefined),
    prisma.affiliate.findMany({
      where: {
        status: "ACTIVE",
        ...(campaignId ? { assignments: { some: { campaignId, status: "ACTIVE" } } } : {}),
      },
      select: { id: true },
    }),
  ]);

  const byId = new Map<string, Aggregate>();
  const get = (id: string): Aggregate => {
    let row = byId.get(id);
    if (!row) {
      row = { affiliateId: id, clicks: 0, views: 0, threads: 0, revenue: 0 };
      byId.set(id, row);
    }
    return row;
  };

  // Include every eligible affiliate even with zero activity.
  for (const a of affiliates) get(a.id);
  for (const c of clicksBy) get(c.affiliateId).clicks = c._count._all;
  for (const c of convsBy) get(c.affiliateId).revenue = Number(c._sum.revenue ?? 0);
  for (const t of threads) {
    const row = get(t.affiliateId);
    row.views += t.views;
    row.threads += 1;
  }

  return Array.from(byId.values());
}

/** Recomputes and persists all leaderboards (global + one per campaign). */
export async function computeLeaderboards(): Promise<{ entries: number; campaigns: number }> {
  const campaigns = await prisma.campaign.findMany({
    where: { status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } },
    select: { id: true },
  });

  const scopes: (string | null)[] = [null, ...campaigns.map((c) => c.id)];
  let total = 0;

  for (const campaignId of scopes) {
    const ranked = rankAggregates(await aggregateFor(campaignId));
    total += ranked.length;

    await prisma.$transaction([
      prisma.leaderboardEntry.deleteMany({ where: { campaignId } }),
      prisma.leaderboardEntry.createMany({
        data: ranked.map((r) => ({
          affiliateId: r.affiliateId,
          campaignId,
          rank: r.rank,
          clicks: r.clicks,
          views: r.views,
          threads: r.threads,
          revenue: r.revenue,
        })),
      }),
    ]);
  }

  return { entries: total, campaigns: scopes.length - 1 };
}

export type LeaderboardRow = {
  rank: number;
  affiliateId: string;
  displayName: string;
  clicks: number;
  views: number;
  threads: number;
  revenue: number;
  computedAt: Date;
};

/** Reads the cached leaderboard; computes it first if the cache is empty. */
export async function getLeaderboard(
  campaignId: string | null = null,
  limit = 50,
): Promise<LeaderboardRow[]> {
  let entries = await prisma.leaderboardEntry.findMany({
    where: { campaignId },
    include: { affiliate: { select: { displayName: true } } },
    orderBy: { rank: "asc" },
    take: limit,
  });

  if (entries.length === 0) {
    await computeLeaderboards();
    entries = await prisma.leaderboardEntry.findMany({
      where: { campaignId },
      include: { affiliate: { select: { displayName: true } } },
      orderBy: { rank: "asc" },
      take: limit,
    });
  }

  return entries.map((e) => ({
    rank: e.rank,
    affiliateId: e.affiliateId,
    displayName: e.affiliate.displayName,
    clicks: e.clicks,
    views: e.views,
    threads: e.threads,
    revenue: Number(e.revenue),
    computedAt: e.computedAt,
  }));
}

export async function getAffiliateRank(
  affiliateId: string,
): Promise<{ rank: number; total: number } | null> {
  // findFirst, not findUnique: campaignId is NULL for the global scope and
  // Prisma compound-unique lookups don't accept null members.
  const [entry, total] = await Promise.all([
    prisma.leaderboardEntry.findFirst({ where: { affiliateId, campaignId: null } }),
    prisma.leaderboardEntry.count({ where: { campaignId: null } }),
  ]);
  if (!entry) return null;
  return { rank: entry.rank, total };
}
