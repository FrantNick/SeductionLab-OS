import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClicksPerDay, getTopThreads } from "@/lib/analytics";
import {
  getPeriodStats,
  getRecentActivity,
  getRevenuePerDay,
  getViewsPerDay,
  type PeriodStats,
} from "@/lib/analytics-periods";
import { getAffiliateRank, getLeaderboard } from "@/lib/leaderboard";
import { getNotifications } from "@/lib/notifications";
import { isFlagEnabled } from "@/lib/feature-flags";
import { formatMoney, formatNumber, formatPercent, formatDate, timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, InternalLink, PageHeader } from "@/components/ui";
import { TimeSeriesChart } from "@/components/charts";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { NotificationsPanel } from "@/components/notifications-panel";

export const dynamic = "force-dynamic";

const ACTIVITY_ICONS = { click: "↗", conversion: "$", thread: "𝕏" } as const;

function PeriodRow({ label, stats }: { label: string; stats: PeriodStats }) {
  return (
    <tr>
      <td className="font-medium text-zinc-300">{label}</td>
      <td className="num text-right">{formatNumber(stats.views)}</td>
      <td className="num text-right">{formatNumber(stats.clicks)}</td>
      <td className="num text-right">{formatPercent(stats.ctr)}</td>
      <td className="num text-right font-medium text-zinc-200">{formatMoney(stats.revenue)}</td>
    </tr>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const affiliateId = session?.user.affiliateId;

  if (!affiliateId) {
    return (
      <Card>
        <EmptyState
          title="No affiliate profile on this account"
          hint="Admins manage the platform from the admin area."
        />
        <div className="pb-6 text-center">
          <Link href="/admin" className="btn-primary">
            Go to admin
          </Link>
        </div>
      </Card>
    );
  }

  const [
    periods,
    rank,
    leaderboard,
    assignments,
    clicksPerDay,
    viewsPerDay,
    revenuePerDay,
    activity,
    bestThreads,
    notifications,
    experimentsEnabled,
  ] = await Promise.all([
    getPeriodStats(affiliateId),
    getAffiliateRank(affiliateId),
    getLeaderboard(null, 10),
    prisma.campaignAssignment.findMany({
      where: { affiliateId, status: "ACTIVE", campaign: { status: "ACTIVE" } },
      include: { campaign: { include: { product: true } } },
    }),
    getClicksPerDay(30, { affiliateId }),
    getViewsPerDay(30, affiliateId),
    getRevenuePerDay(30, affiliateId),
    getRecentActivity(affiliateId),
    getTopThreads({ by: "views", limit: 5, affiliateId }),
    getNotifications(session!.user.id, 15),
    isFlagEnabled("experiments"),
  ]);

  const experiments = experimentsEnabled
    ? await prisma.experiment.findMany({
        where: {
          status: "RUNNING",
          assignments: { some: { affiliateId } },
        },
        include: { campaign: { select: { name: true } } },
        orderBy: { endDate: "asc" },
      })
    : [];

  const myRank = rank ?? (await getAffiliateRank(affiliateId));

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Your performance across all campaigns."
        action={
          myRank && (
            <div className="card px-4 py-2 text-right">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Leaderboard</p>
              <p className="text-lg font-semibold text-ember-text">
                #{myRank.rank} <span className="text-xs text-zinc-500">of {myRank.total}</span>
              </p>
            </div>
          )
        }
      />

      {/* Today's headline stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Views today</p>
          <p className="mt-1.5 text-2xl font-semibold text-white">
            {formatNumber(periods.today.views)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            yesterday {formatNumber(periods.yesterday.views)}
          </p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Clicks today</p>
          <p className="mt-1.5 text-2xl font-semibold text-white">
            {formatNumber(periods.today.clicks)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            yesterday {formatNumber(periods.yesterday.clicks)}
          </p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">CTR today</p>
          <p className="mt-1.5 text-2xl font-semibold text-white">
            {formatPercent(periods.today.ctr)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            30-day {formatPercent(periods.last30.ctr)}
          </p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Revenue today
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-white">
            {formatMoney(periods.today.revenue)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            30-day {formatMoney(periods.last30.revenue)}
          </p>
        </div>
      </div>

      {/* Period breakdown + notifications */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title="Performance by period" className="lg:col-span-3" padded={false}>
          <table className="table-base">
            <thead>
              <tr>
                <th>Period</th>
                <th className="text-right">Views</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">CTR</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              <PeriodRow label="Today" stats={periods.today} />
              <PeriodRow label="Yesterday" stats={periods.yesterday} />
              <PeriodRow label="Last 7 days" stats={periods.last7} />
              <PeriodRow label="Last 30 days" stats={periods.last30} />
            </tbody>
          </table>
        </Card>

        <Card title="Notifications" className="lg:col-span-2" padded={false}>
          <NotificationsPanel items={notifications} />
        </Card>
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Views — last 30 days">
          <TimeSeriesChart data={viewsPerDay} />
        </Card>
        <Card title="Clicks — last 30 days">
          <TimeSeriesChart data={clicksPerDay.map((d) => ({ date: d.date, value: d.clicks }))} />
        </Card>
        <Card title="Revenue — last 30 days">
          <TimeSeriesChart data={revenuePerDay} format="money" />
        </Card>
      </div>

      {/* Campaigns + experiments + activity */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Assigned campaigns" padded={false}>
          {assignments.length === 0 ? (
            <EmptyState title="No active campaigns" hint="An admin will assign you soon." />
          ) : (
            <ul className="divide-y divide-ink-800">
              {assignments.map((a) => (
                <li key={a.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Link
                        href="/dashboard/campaigns"
                        className="text-sm font-medium text-zinc-200 hover:text-ember-text"
                      >
                        {a.campaign.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {a.campaign.product.name} · {a.campaign.angle}
                      </p>
                    </div>
                    <Badge value={a.campaign.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {experimentsEnabled && (
            <Card title="Active experiments" padded={false}>
              {experiments.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-zinc-500">
                  No running experiments include you right now.
                </p>
              ) : (
                <ul className="divide-y divide-ink-800">
                  {experiments.map((e) => (
                    <li key={e.id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{e.name}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {e.campaign.name} · ends {formatDate(e.endDate)}
                          </p>
                        </div>
                        <Badge value="ACTIVE" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card title="Recent activity" padded={false}>
            {activity.length === 0 ? (
              <EmptyState title="Nothing yet" hint="Clicks, sales and threads appear here." />
            ) : (
              <ul className="divide-y divide-ink-800">
                {activity.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-700 text-xs text-ember-text">
                      {ACTIVITY_ICONS[item.kind]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">{item.title}</p>
                      {item.detail && <p className="text-xs text-zinc-500">{item.detail}</p>}
                    </div>
                    <span className="shrink-0 text-[11px] text-zinc-600">{timeAgo(item.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Best threads */}
      <Card title="Best threads by views" className="mt-6" padded={false}>
        {bestThreads.length === 0 ? (
          <EmptyState title="No threads yet" hint="Submit your first thread to see it ranked." />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Thread</th>
                <th>Campaign</th>
                <th className="text-right">Views</th>
                <th className="text-right">CTR</th>
                <th className="text-right">Attributed revenue</th>
              </tr>
            </thead>
            <tbody>
              {bestThreads.map((t) => (
                <tr key={t.id}>
                  <td>
                    <InternalLink href={`/dashboard/threads/${t.id}`}>
                      {t.text ? `${t.text.slice(0, 48)}${t.text.length > 48 ? "…" : ""}` : `Tweet ${t.twitterId}`}
                    </InternalLink>
                  </td>
                  <td className="text-zinc-400">{t.campaignName}</td>
                  <td className="num text-right">{formatNumber(t.views)}</td>
                  <td className="num text-right">{formatPercent(t.ctr)}</td>
                  <td className="num text-right">{formatMoney(t.attributedRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Leaderboard */}
      <Card title="Leaderboard — top 10" className="mt-6" padded={false}>
        <LeaderboardTable rows={leaderboard} highlightAffiliateId={affiliateId} />
      </Card>
    </>
  );
}
