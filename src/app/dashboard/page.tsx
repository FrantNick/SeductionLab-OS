import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAffiliateOverview, getClicksPerDay } from "@/lib/analytics";
import { getAffiliateRank, getLeaderboard } from "@/lib/leaderboard";
import { formatMoney, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ClicksAreaChart } from "@/components/charts";

export const dynamic = "force-dynamic";

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

  const [overview, rank, leaderboard, assignments, clicksPerDay] = await Promise.all([
    getAffiliateOverview(affiliateId),
    getAffiliateRank(affiliateId),
    getLeaderboard(null, 10),
    prisma.campaignAssignment.findMany({
      where: { affiliateId, status: "ACTIVE", campaign: { status: "ACTIVE" } },
      include: { campaign: { include: { product: true } } },
    }),
    getClicksPerDay(14, { affiliateId }),
  ]);

  // getLeaderboard computes the cache on first run, so retry the rank once.
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clicks" value={formatNumber(overview.clicks)} />
        <StatCard label="Thread views" value={formatNumber(overview.views)} />
        <StatCard
          label="CTR"
          value={formatPercent(overview.ctr)}
          hint="clicks ÷ thread views"
        />
        <StatCard
          label="Revenue"
          value={formatMoney(overview.revenue)}
          hint={`${overview.conversions} conversions · CVR ${formatPercent(overview.cvr)}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title="Clicks — last 14 days" className="lg:col-span-3">
          <ClicksAreaChart data={clicksPerDay} />
        </Card>

        <Card title="Active campaigns" className="lg:col-span-2" padded={false}>
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
      </div>

      <Card title="Leaderboard — top 10" className="mt-6" padded={false}>
        {leaderboard.length === 0 ? (
          <EmptyState title="Leaderboard has not been computed yet" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-14">Rank</th>
                <th>Affiliate</th>
                <th className="text-right">Threads</th>
                <th className="text-right">Views</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr
                  key={row.affiliateId}
                  className={row.affiliateId === affiliateId ? "bg-ember-soft" : ""}
                >
                  <td className="num font-medium text-zinc-400">#{row.rank}</td>
                  <td className="font-medium text-zinc-200">
                    {row.displayName}
                    {row.affiliateId === affiliateId && (
                      <span className="ml-2 text-xs text-ember-text">you</span>
                    )}
                  </td>
                  <td className="num text-right">{formatNumber(row.threads)}</td>
                  <td className="num text-right">{formatNumber(row.views)}</td>
                  <td className="num text-right">{formatNumber(row.clicks)}</td>
                  <td className="num text-right font-medium text-zinc-200">
                    {formatMoney(row.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {leaderboard[0] && (
          <p className="border-t border-ink-800 px-5 py-2.5 text-[11px] text-zinc-500">
            Recomputed every 10 minutes · last update {timeAgo(leaderboard[0].computedAt)}
          </p>
        )}
      </Card>
    </>
  );
}
