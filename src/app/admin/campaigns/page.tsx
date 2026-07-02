import { prisma } from "@/lib/prisma";
import { getCampaignStats } from "@/lib/analytics";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { Badge, Card, EmptyState, InternalLink, PageHeader } from "@/components/ui";
import { createCampaign } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  const [products, stats] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    getCampaignStats(),
  ]);

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Each campaign is one marketing angle for one product."
      />

      <Card title="Create campaign">
        {products.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Create a <InternalLink href="/admin/products">product</InternalLink> first — every
            campaign promotes exactly one product.
          </p>
        ) : (
          <form action={createCampaign} className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Name</label>
              <input name="name" className="input" required minLength={2} placeholder="Confidence Reset — July push" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Product</label>
              <select name="productId" className="input" required>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatMoney(Number(p.price))}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Angle</label>
              <input name="angle" className="input" required placeholder='e.g. "Fix your first impression in 7 days"' />
            </div>
            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Instructions for affiliates
              </label>
              <textarea name="instructions" className="input" rows={3} placeholder="Tone, structure, do's and don'ts…" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Example hook</label>
              <input name="exampleHook" className="input" placeholder="First tweet of the thread" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Example CTA</label>
              <input name="exampleCTA" className="input" placeholder="Last tweet — the pitch" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Status</label>
              <select name="status" className="input" defaultValue="ACTIVE">
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Start date</label>
                <input name="startDate" type="date" className="input" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">End date</label>
                <input name="endDate" type="date" className="input" />
              </div>
            </div>
            <div className="lg:col-span-2">
              <button type="submit" className="btn-primary">
                Create campaign
              </button>
            </div>
          </form>
        )}
      </Card>

      <Card title="All campaigns" className="mt-6" padded={false}>
        {stats.length === 0 ? (
          <EmptyState title="No campaigns yet" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th className="text-right">Affiliates</th>
                <th className="text-right">Threads</th>
                <th className="text-right">Views</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">CTR</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((c) => (
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
                  <td className="num text-right">{c.threads}</td>
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
