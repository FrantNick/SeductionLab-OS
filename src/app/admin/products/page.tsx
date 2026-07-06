import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatPercent } from "@/lib/format";
import { Badge, Card, EmptyState, ExternalLink, InternalLink, PageHeader } from "@/components/ui";
import { ConfirmAction } from "@/components/confirm-dialog";
import { createProduct, setProductArchived, updateProduct } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [products, convsBy, clicksBy, affiliatesBy] = await Promise.all([
    prisma.product.findMany({
      include: { _count: { select: { campaigns: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.conversion.groupBy({
      by: ["productId"],
      _count: { _all: true },
      _sum: { revenue: true },
    }),
    prisma.click.groupBy({ by: ["trackingLinkId"], _count: { _all: true } }),
    prisma.trackingLink.findMany({ select: { id: true, productId: true, affiliateId: true } }),
  ]);

  // clicks + distinct affiliates per product via tracking links
  const linkClicks = new Map(clicksBy.map((c) => [c.trackingLinkId, c._count._all]));
  const productClicks = new Map<string, number>();
  const productAffiliates = new Map<string, Set<string>>();
  for (const link of affiliatesBy) {
    productClicks.set(link.productId, (productClicks.get(link.productId) ?? 0) + (linkClicks.get(link.id) ?? 0));
    if (!productAffiliates.has(link.productId)) productAffiliates.set(link.productId, new Set());
    productAffiliates.get(link.productId)!.add(link.affiliateId);
  }
  const convMap = new Map(
    convsBy.map((c) => [
      c.productId,
      { count: c._count._all, revenue: Number(c._sum.revenue ?? 0) },
    ]),
  );

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="What campaigns sell — tracking links redirect to the landing page with affiliate parameters; its JS swaps in the affiliate checkout."
      />

      <Card title="Add product">
        <form action={createProduct} className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Name</label>
            <input name="name" className="input" required minLength={2} placeholder="Confidence Reset (ebook)" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Price (USD)</label>
            <input name="price" type="number" min="0.01" step="0.01" className="input num" required placeholder="49.00" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              Add product
            </button>
          </div>
          <div className="sm:col-span-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Landing page URL
            </label>
            <input name="landingUrl" type="url" className="input" required placeholder="https://www.seduction-lab.com/products/the-story-method" />
            <p className="mt-1 text-xs text-zinc-500">
              One page for every affiliate — links add <code>?affiliate=…&amp;ref=…</code>{" "}
              (names configurable under Settings → Affiliate tracking).
            </p>
          </div>
        </form>
      </Card>

      <Card title="All products" className="mt-6" padded={false}>
        {products.length === 0 ? (
          <EmptyState title="No products yet" hint="Add one above to start creating campaigns." />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th className="text-right">Price</th>
                <th className="text-right">Campaigns</th>
                <th className="text-right">Affiliates</th>
                <th className="text-right">CVR</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const conv = convMap.get(p.id) ?? { count: 0, revenue: 0 };
                const clicks = productClicks.get(p.id) ?? 0;
                const cvr = clicks > 0 ? conv.count / clicks : 0;
                const archived = p.archivedAt !== null;
                return (
                  <tr key={p.id} className={archived ? "opacity-60" : ""}>
                    <td>
                      <InternalLink href={`/admin/products/${p.id}`}>{p.name}</InternalLink>
                      <p className="max-w-xs truncate text-xs">
                        <ExternalLink href={p.landingUrl}>{p.landingUrl}</ExternalLink>
                      </p>
                      {/* Inline editor — disclosure keeps the table server-rendered */}
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                          Edit
                        </summary>
                        <form
                          action={updateProduct.bind(null, p.id)}
                          className="mt-2 grid max-w-md gap-2"
                        >
                          <input name="name" className="input" defaultValue={p.name} required />
                          <input
                            name="price"
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="input num"
                            defaultValue={Number(p.price)}
                            required
                          />
                          <input
                            name="landingUrl"
                            type="url"
                            className="input"
                            defaultValue={p.landingUrl}
                            required
                          />
                          <button type="submit" className="btn-secondary w-fit">
                            Save
                          </button>
                        </form>
                      </details>
                    </td>
                    <td>
                      <Badge value={archived ? "PAUSED" : "ACTIVE"} />
                    </td>
                    <td className="num text-right">{formatMoney(Number(p.price))}</td>
                    <td className="num text-right">
                      <InternalLink href="/admin/campaigns">{p._count.campaigns}</InternalLink>
                    </td>
                    <td className="num text-right">{productAffiliates.get(p.id)?.size ?? 0}</td>
                    <td className="num text-right">{formatPercent(cvr)}</td>
                    <td className="num text-right font-medium text-zinc-200">
                      {formatMoney(conv.revenue)}
                    </td>
                    <td className="text-right">
                      <Link href={`/admin/products/${p.id}`} className="btn-ghost">
                        Affiliate URLs
                      </Link>
                      {archived ? (
                        <form action={setProductArchived.bind(null, p.id, false)}>
                          <button className="btn-ghost">Restore</button>
                        </form>
                      ) : (
                        <ConfirmAction
                          action={setProductArchived.bind(null, p.id, true)}
                          title="Archive product?"
                          description="It stays on existing campaigns but is hidden from new ones. Nothing is deleted."
                          confirmLabel="Archive"
                        >
                          <span className="btn-ghost text-red-400 hover:text-red-300">Archive</span>
                        </ConfirmAction>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
