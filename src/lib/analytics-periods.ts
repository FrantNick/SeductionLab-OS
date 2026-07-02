import { prisma } from "@/lib/prisma";

/**
 * Time-windowed analytics for the dashboard: today / yesterday /
 * last 7 / last 30 days, plus per-day series for charts.
 *
 * Clicks and revenue are timestamped events, so windowing is exact.
 * Views come from append-only ThreadMetrics snapshots, so a window's
 * views are the *delta* between the latest snapshot inside the window
 * end and the latest snapshot before the window start.
 */

export type PeriodStats = {
  views: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
};

export type DashboardPeriods = {
  today: PeriodStats;
  yesterday: PeriodStats;
  last7: PeriodStats;
  last30: PeriodStats;
};

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysAgo(n: number): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
}

type Window = { from: Date; to: Date };

function windows(): Record<keyof DashboardPeriods, Window> {
  const now = new Date();
  return {
    today: { from: daysAgo(0), to: now },
    yesterday: { from: daysAgo(1), to: daysAgo(0) },
    last7: { from: daysAgo(7), to: now },
    last30: { from: daysAgo(30), to: now },
  };
}

export async function getPeriodStats(affiliateId?: string): Promise<DashboardPeriods> {
  const wins = windows();
  const where = affiliateId ? { affiliateId } : {};

  const [clicks, conversions, snapshots] = await Promise.all([
    prisma.click.findMany({
      where: { ...where, createdAt: { gte: wins.last30.from } },
      select: { createdAt: true },
    }),
    prisma.conversion.findMany({
      where: { ...where, createdAt: { gte: wins.last30.from } },
      select: { createdAt: true, revenue: true },
    }),
    prisma.threadMetrics.findMany({
      where: { thread: affiliateId ? { affiliateId } : {} },
      select: { threadId: true, views: true, scrapedAt: true },
      orderBy: { scrapedAt: "asc" },
    }),
  ]);

  // views for a thread at time t = latest snapshot at or before t
  const viewsAt = (t: Date): number => {
    const latest = new Map<string, number>();
    for (const s of snapshots) {
      if (s.scrapedAt <= t) latest.set(s.threadId, s.views);
    }
    let sum = 0;
    for (const v of latest.values()) sum += v;
    return sum;
  };

  const compute = (win: Window): PeriodStats => {
    const clickCount = clicks.filter((c) => c.createdAt >= win.from && c.createdAt < win.to).length;
    const convs = conversions.filter((c) => c.createdAt >= win.from && c.createdAt < win.to);
    const revenue = convs.reduce((sum, c) => sum + Number(c.revenue), 0);
    const views = Math.max(0, viewsAt(win.to) - viewsAt(win.from));
    return {
      views,
      clicks: clickCount,
      conversions: convs.length,
      revenue,
      ctr: views > 0 ? clickCount / views : 0,
    };
  };

  return {
    today: compute(wins.today),
    yesterday: compute(wins.yesterday),
    last7: compute(wins.last7),
    last30: compute(wins.last30),
  };
}

export type DailyPoint = { date: string; value: number };

export async function getRevenuePerDay(days: number, affiliateId?: string): Promise<DailyPoint[]> {
  const since = daysAgo(days);
  const conversions = await prisma.conversion.findMany({
    where: { ...(affiliateId ? { affiliateId } : {}), createdAt: { gte: since } },
    select: { createdAt: true, revenue: true },
  });

  const buckets = emptyBuckets(days);
  for (const c of conversions) {
    const key = c.createdAt.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(c.revenue));
  }
  return [...buckets.entries()].map(([date, value]) => ({ date, value }));
}

/** Total thread views per day, reconstructed from metric snapshots. */
export async function getViewsPerDay(days: number, affiliateId?: string): Promise<DailyPoint[]> {
  const snapshots = await prisma.threadMetrics.findMany({
    where: { thread: affiliateId ? { affiliateId } : {} },
    select: { threadId: true, views: true, scrapedAt: true },
    orderBy: { scrapedAt: "asc" },
  });

  const buckets = emptyBuckets(days);
  const dates = [...buckets.keys()];
  for (const date of dates) {
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    const latest = new Map<string, number>();
    for (const s of snapshots) {
      if (s.scrapedAt <= endOfDay) latest.set(s.threadId, s.views);
    }
    let sum = 0;
    for (const v of latest.values()) sum += v;
    buckets.set(date, sum);
  }
  return [...buckets.entries()].map(([date, value]) => ({ date, value }));
}

function emptyBuckets(days: number): Map<string, number> {
  const buckets = new Map<string, number>();
  const start = daysAgo(days);
  for (let i = 0; i <= days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (d > new Date()) break;
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  return buckets;
}

export type ActivityItem = {
  id: string;
  kind: "click" | "conversion" | "thread";
  title: string;
  detail: string;
  at: Date;
};

/** Merged recent activity feed (clicks are day-aggregated to avoid noise). */
export async function getRecentActivity(affiliateId?: string, limit = 12): Promise<ActivityItem[]> {
  const where = affiliateId ? { affiliateId } : {};
  const [conversions, threads, clicksToday] = await Promise.all([
    prisma.conversion.findMany({
      where,
      include: {
        campaign: { select: { name: true } },
        affiliate: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.thread.findMany({
      where,
      include: {
        campaign: { select: { name: true } },
        affiliate: { select: { displayName: true } },
      },
      orderBy: { postedAt: "desc" },
      take: 6,
    }),
    prisma.click.count({ where: { ...where, createdAt: { gte: daysAgo(0) } } }),
  ]);

  const items: ActivityItem[] = [
    ...conversions.map((c) => ({
      id: `conv-${c.id}`,
      kind: "conversion" as const,
      title: `$${Number(c.revenue).toFixed(0)} sale — ${c.campaign.name}`,
      detail: affiliateId ? "recorded by admin" : `by ${c.affiliate.displayName}`,
      at: c.createdAt,
    })),
    ...threads.map((t) => ({
      id: `thread-${t.id}`,
      kind: "thread" as const,
      title: `Thread submitted — ${t.campaign.name}`,
      detail: affiliateId ? "" : `by ${t.affiliate.displayName}`,
      at: t.postedAt,
    })),
  ];

  if (clicksToday > 0) {
    items.push({
      id: "clicks-today",
      kind: "click",
      title: `${clicksToday} clicks tracked today`,
      detail: "across all tracking links",
      at: new Date(),
    });
  }

  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
