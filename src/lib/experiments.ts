import { prisma } from "@/lib/prisma";
import { getThreadsWithLatestMetrics } from "@/lib/analytics";

/**
 * Experiments scope existing campaign activity to a time window and an
 * affiliate cohort — they reuse the Click/Conversion/Thread pipelines
 * untouched, so campaigns keep working exactly as before.
 */

export type ExperimentMetrics = {
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  perAffiliate: {
    affiliateId: string;
    displayName: string;
    clicks: number;
    revenue: number;
    threads: number;
  }[];
  leaderId: string | null;
};

export async function getExperimentMetrics(experimentId: string): Promise<ExperimentMetrics | null> {
  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: { assignments: { include: { affiliate: { select: { displayName: true } } } } },
  });
  if (!experiment) return null;

  const affiliateIds = experiment.assignments.map((a) => a.affiliateId);
  const window = { gte: experiment.startDate, lte: experiment.endDate };
  const scope = {
    campaignId: experiment.campaignId,
    affiliateId: { in: affiliateIds },
  };

  const [clicks, conversions, threads] = await Promise.all([
    prisma.click.groupBy({
      by: ["affiliateId"],
      where: { ...scope, createdAt: window },
      _count: { _all: true },
    }),
    prisma.conversion.groupBy({
      by: ["affiliateId"],
      where: { ...scope, createdAt: window },
      _count: { _all: true },
      _sum: { revenue: true },
    }),
    getThreadsWithLatestMetrics({ campaignId: experiment.campaignId }),
  ]);

  const inWindow = threads.filter(
    (t) =>
      affiliateIds.includes(t.affiliateId) &&
      t.postedAt >= experiment.startDate &&
      t.postedAt <= experiment.endDate,
  );

  const clickMap = new Map(clicks.map((c) => [c.affiliateId, c._count._all]));
  const revMap = new Map(
    conversions.map((c) => [
      c.affiliateId,
      { count: c._count._all, revenue: Number(c._sum.revenue ?? 0) },
    ]),
  );

  const perAffiliate = experiment.assignments.map((a) => {
    const threadRows = inWindow.filter((t) => t.affiliateId === a.affiliateId);
    return {
      affiliateId: a.affiliateId,
      displayName: a.affiliate.displayName,
      clicks: clickMap.get(a.affiliateId) ?? 0,
      revenue: revMap.get(a.affiliateId)?.revenue ?? 0,
      threads: threadRows.length,
    };
  });
  perAffiliate.sort((a, b) => b.revenue - a.revenue || b.clicks - a.clicks);

  const totalViews = inWindow.reduce((sum, t) => sum + t.views, 0);
  const totalClicks = [...clickMap.values()].reduce((a, b) => a + b, 0);
  const totalConvs = [...revMap.values()].reduce((a, b) => a + b.count, 0);
  const totalRevenue = [...revMap.values()].reduce((a, b) => a + b.revenue, 0);

  return {
    views: totalViews,
    clicks: totalClicks,
    conversions: totalConvs,
    revenue: totalRevenue,
    ctr: totalViews > 0 ? totalClicks / totalViews : 0,
    perAffiliate,
    leaderId: perAffiliate[0]?.affiliateId ?? null,
  };
}
