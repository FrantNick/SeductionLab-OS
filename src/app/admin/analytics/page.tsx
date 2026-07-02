import { getAffiliatePerformance, getCampaignStats, getTopThreads } from "@/lib/analytics";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { Card, EmptyState, ExternalLink, InternalLink, PageHeader } from "@/components/ui";
import { CategoryBarChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const [campaigns, affiliates, topByViews, topByCtr, topByRevenue] = await Promise.all([
    getCampaignStats(),
    getAffiliatePerformance(),
    getTopThreads({ by: "views", limit: 5 }),
    getTopThreads({ by: "ctr", limit: 5 }),
    getTopThreads({ by: "revenue", limit: 5 }),
  ]);

  const withActivity = campaigns.filter((c) => c.views > 0 || c.clicks > 0 || c.revenue > 0);
  const topAffiliates = [...affiliates]
    .sort((a, b) => b.revenue - a.revenue || b.clicks - a.clicks)
    .slice(0, 10);

  const threadTables = [
    { title: "Top threads by views", rows: topByViews },
    { title: "Top threads by CTR", rows: topByCtr },
    { title: "Top threads by revenue", rows: topByRevenue },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="CTR = clicks ÷ views · CVR = conversions ÷ clicks · thread clicks/revenue are exact via each thread's own tracking link."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="CTR per campaign">
          {withActivity.length === 0 ? (
            <EmptyState title="No campaign activity yet" />
          ) : (
            <CategoryBarChart
              data={withActivity.map((c) => ({ name: c.campaignName, value: c.ctr }))}
              format="percent"
            />
          )}
        </Card>
        <Card title="Revenue per campaign">
          {withActivity.length === 0 ? (
            <EmptyState title="No campaign activity yet" />
          ) : (
            <CategoryBarChart
              data={withActivity.map((c) => ({ name: c.campaignName, value: c.revenue }))}
              format="money"
            />
          )}
        </Card>
      </div>

      <Card title="Campaign performance" className="mt-6" padded={false}>
        {campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Campaign</th>
                <th className="text-right">Views</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">CTR</th>
                <th className="text-right">Conversions</th>
                <th className="text-right">CVR</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaignId}>
                  <td>
                    <InternalLink href={`/admin/campaigns/${c.campaignId}`}>
                      {c.campaignName}
                    </InternalLink>
                  </td>
                  <td className="num text-right">{formatNumber(c.views)}</td>
                  <td className="num text-right">{formatNumber(c.clicks)}</td>
                  <td className="num text-right">{formatPercent(c.ctr)}</td>
                  <td className="num text-right">{c.conversions}</td>
                  <td className="num text-right">{formatPercent(c.cvr)}</td>
                  <td className="num text-right font-medium text-zinc-200">
                    {formatMoney(c.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Top affiliates" className="mt-6" padded={false}>
        {topAffiliates.length === 0 ? (
          <EmptyState title="No affiliates yet" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Affiliate</th>
                <th className="text-right">Threads</th>
                <th className="text-right">Views</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">CTR</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topAffiliates.map((a) => (
                <tr key={a.affiliateId}>
                  <td className="font-medium text-zinc-200">{a.displayName}</td>
                  <td className="num text-right">{a.threads}</td>
                  <td className="num text-right">{formatNumber(a.views)}</td>
                  <td className="num text-right">{formatNumber(a.clicks)}</td>
                  <td className="num text-right">{formatPercent(a.ctr)}</td>
                  <td className="num text-right font-medium text-zinc-200">
                    {formatMoney(a.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {threadTables.map(({ title, rows }) => (
          <Card key={title} title={title} padded={false}>
            {rows.length === 0 ? (
              <EmptyState title="No thread data" />
            ) : (
              <ul className="divide-y divide-ink-800">
                {rows.map((t, i) => (
                  <li key={t.id} className="px-5 py-3">
                    <div className="flex items-start gap-3">
                      <span className="num text-sm font-semibold text-zinc-500">#{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <InternalLink href={`/dashboard/threads/${t.id}`}>
                          {t.text ? `${t.text.slice(0, 40)}${t.text.length > 40 ? "…" : ""}` : `Tweet ${t.twitterId}`}
                        </InternalLink>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {t.affiliateName} · {t.campaignName} ·{" "}
                          <ExternalLink href={t.twitterUrl}>open ↗</ExternalLink>
                        </p>
                        <p className="num mt-1 text-xs text-zinc-400">
                          {formatNumber(t.views)} views · {formatPercent(t.ctr)} CTR ·{" "}
                          {formatMoney(t.attributedRevenue)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
