import { getCampaignStats, getClicksPerDay, getGlobalStats } from "@/lib/analytics";
import { getLeaderboard } from "@/lib/leaderboard";
import { formatMoney, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, InternalLink, PageHeader, StatCard } from "@/components/ui";
import { ClicksAreaChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [stats, campaigns, leaderboard, clicksPerDay] = await Promise.all([
    getGlobalStats(),
    getCampaignStats(),
    getLeaderboard(null, 5),
    getClicksPerDay(14),
  ]);

  const topCampaigns = [...campaigns].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return (
    <>
      <PageHeader title="Overview" subtitle="Global performance across every campaign." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(stats.revenue)} hint={`${stats.conversions} conversions`} />
        <StatCard label="Clicks" value={formatNumber(stats.clicks)} hint={`CVR ${formatPercent(stats.cvr)}`} />
        <StatCard label="Thread views" value={formatNumber(stats.views)} hint={`CTR ${formatPercent(stats.ctr)}`} />
        <StatCard
          label="Network"
          value={`${stats.affiliates}`}
          hint={`active affiliates · ${stats.activeCampaigns} live campaigns · ${stats.threads} threads`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title="Clicks — last 14 days" className="lg:col-span-3">
          <ClicksAreaChart data={clicksPerDay} />
        </Card>

        <Card title="Top affiliates" className="lg:col-span-2" padded={false}>
          {leaderboard.length === 0 ? (
            <EmptyState title="No leaderboard data yet" />
          ) : (
            <ul className="divide-y divide-ink-800">
              {leaderboard.map((row) => (
                <li key={row.affiliateId} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="num w-8 text-sm font-semibold text-zinc-500">#{row.rank}</span>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{row.displayName}</p>
                      <p className="text-xs text-zinc-500">
                        {formatNumber(row.clicks)} clicks · {formatNumber(row.views)} views
                      </p>
                    </div>
                  </div>
                  <span className="num text-sm font-semibold text-white">
                    {formatMoney(row.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {leaderboard[0] && (
            <p className="border-t border-ink-800 px-5 py-2.5 text-[11px] text-zinc-500">
              Cached · updated {timeAgo(leaderboard[0].computedAt)}
            </p>
          )}
        </Card>
      </div>

      <Card title="Campaigns by revenue" className="mt-6" padded={false}>
        {topCampaigns.length === 0 ? (
          <EmptyState title="No campaigns yet" hint="Create one under Campaigns." />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th className="text-right">Affiliates</th>
                <th className="text-right">Views</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">CTR</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topCampaigns.map((c) => (
                <tr key={c.campaignId}>
                  <td>
                    <InternalLink href={`/admin/campaigns/${c.campaignId}`}>
                      {c.campaignName}
                    </InternalLink>
                    <p className="text-xs text-zinc-500">{c.productName}</p>
                  </td>
                  <td>
                    <Badge value={c.status} />
                  </td>
                  <td className="num text-right">{c.affiliates}</td>
                  <td className="num text-right">{formatNumber(c.views)}</td>
                  <td className="num text-right">{formatNumber(c.clicks)}</td>
                  <td className="num text-right">{formatPercent(c.ctr)}</td>
                  <td className="num text-right font-medium text-zinc-200">
                    {formatMoney(c.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
