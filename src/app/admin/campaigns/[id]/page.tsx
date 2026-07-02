import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLeaderboard } from "@/lib/leaderboard";
import { getThreadsWithLatestMetrics } from "@/lib/analytics";
import { formatMoney, formatNumber, timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, InternalLink, PageHeader } from "@/components/ui";
import {
  assignAffiliateForm,
  setAssignmentStatus,
  setCampaignStatus,
  updateCampaign,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      product: true,
      assignments: { include: { affiliate: true }, orderBy: { affiliate: { displayName: "asc" } } },
    },
  });
  if (!campaign) notFound();

  const [products, unassigned, threads, leaderboard] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.affiliate.findMany({
      where: {
        status: "ACTIVE",
        assignments: { none: { campaignId: id, status: { in: ["ACTIVE", "PAUSED"] } } },
      },
      orderBy: { displayName: "asc" },
    }),
    getThreadsWithLatestMetrics({ campaignId: id }),
    getLeaderboard(id, 20),
  ]);

  const dateValue = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  return (
    <>
      <PageHeader
        title={campaign.name}
        subtitle={`${campaign.product.name} · ${campaign.angle}`}
        action={
          <div className="flex items-center gap-2">
            <Badge value={campaign.status} />
            {campaign.status !== "ACTIVE" ? (
              <form action={setCampaignStatus.bind(null, campaign.id, "ACTIVE")}>
                <button className="btn-secondary">Activate</button>
              </form>
            ) : (
              <form action={setCampaignStatus.bind(null, campaign.id, "PAUSED")}>
                <button className="btn-secondary">Pause</button>
              </form>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Edit campaign">
          <form action={updateCampaign.bind(null, campaign.id)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Name</label>
              <input name="name" className="input" required defaultValue={campaign.name} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Product</label>
              <select name="productId" className="input" defaultValue={campaign.productId}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Angle</label>
              <input name="angle" className="input" required defaultValue={campaign.angle} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Instructions</label>
              <textarea
                name="instructions"
                className="input"
                rows={3}
                defaultValue={campaign.instructions}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Example hook</label>
                <input name="exampleHook" className="input" defaultValue={campaign.exampleHook} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Example CTA</label>
                <input name="exampleCTA" className="input" defaultValue={campaign.exampleCTA} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Status</label>
                <select name="status" className="input" defaultValue={campaign.status}>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Start</label>
                <input
                  name="startDate"
                  type="date"
                  className="input"
                  defaultValue={dateValue(campaign.startDate)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">End</label>
                <input
                  name="endDate"
                  type="date"
                  className="input"
                  defaultValue={dateValue(campaign.endDate)}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              Save changes
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title="Assign affiliate">
            {unassigned.length === 0 ? (
              <p className="text-sm text-zinc-500">Every active affiliate is already assigned.</p>
            ) : (
              <form action={assignAffiliateForm.bind(null, campaign.id)} className="flex gap-3">
                <select name="affiliateId" className="input flex-1">
                  {unassigned.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-primary">
                  Assign
                </button>
              </form>
            )}
          </Card>

          <Card title="Assigned affiliates" padded={false}>
            {campaign.assignments.filter((a) => a.status !== "REMOVED").length === 0 ? (
              <EmptyState title="Nobody assigned yet" />
            ) : (
              <ul className="divide-y divide-ink-800">
                {campaign.assignments
                  .filter((a) => a.status !== "REMOVED")
                  .map((a) => (
                    <li key={a.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-zinc-200">
                          {a.affiliate.displayName}
                        </span>
                        <Badge value={a.status} />
                      </div>
                      <div className="flex gap-1">
                        {a.status === "ACTIVE" ? (
                          <form action={setAssignmentStatus.bind(null, a.id, "PAUSED")}>
                            <button className="btn-ghost">Pause</button>
                          </form>
                        ) : (
                          <form action={setAssignmentStatus.bind(null, a.id, "ACTIVE")}>
                            <button className="btn-ghost">Resume</button>
                          </form>
                        )}
                        <form action={setAssignmentStatus.bind(null, a.id, "REMOVED")}>
                          <button className="btn-ghost text-red-400 hover:text-red-300">
                            Remove
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card title="Campaign leaderboard" className="mt-6" padded={false}>
        {leaderboard.length === 0 ? (
          <EmptyState title="No ranked affiliates yet" />
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
                <tr key={row.affiliateId}>
                  <td className="num font-medium text-zinc-400">#{row.rank}</td>
                  <td className="font-medium text-zinc-200">{row.displayName}</td>
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
      </Card>

      <Card title="Threads in this campaign" className="mt-6" padded={false}>
        {threads.length === 0 ? (
          <EmptyState title="No threads submitted yet" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Thread</th>
                <th>Affiliate</th>
                <th className="text-right">Views</th>
                <th className="text-right">Likes</th>
                <th className="text-right">Retweets</th>
                <th className="text-right">Last scraped</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((t) => (
                <tr key={t.id}>
                  <td>
                    <InternalLink href={`/dashboard/threads/${t.id}`}>
                      {t.text ? `${t.text.slice(0, 48)}${t.text.length > 48 ? "…" : ""}` : `Tweet ${t.twitterId}`}
                    </InternalLink>
                  </td>
                  <td className="text-zinc-400">{t.affiliateName}</td>
                  <td className="num text-right">{formatNumber(t.views)}</td>
                  <td className="num text-right">{formatNumber(t.likes)}</td>
                  <td className="num text-right">{formatNumber(t.retweets)}</td>
                  <td className="text-right text-xs text-zinc-500">{timeAgo(t.scrapedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
