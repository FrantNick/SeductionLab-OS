import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildAffiliateDestination } from "@/lib/tracking";
import { formatMoney, timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, ExternalLink, PageHeader } from "@/components/ui";
import { clearAffiliateProductUrl, saveAffiliateProductUrl } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: { campaigns: { select: { id: true, name: true, status: true } } },
  });
  if (!product) notFound();

  // Every affiliate assigned to any campaign under this product
  const [affiliates, overrides] = await Promise.all([
    prisma.affiliate.findMany({
      where: {
        assignments: {
          some: { campaign: { productId: id }, status: { in: ["ACTIVE", "PAUSED"] } },
        },
      },
      select: { id: true, displayName: true, handle: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.affiliateProductUrl.findMany({ where: { productId: id } }),
  ]);
  const overrideByAffiliate = new Map(overrides.map((o) => [o.affiliateId, o]));

  // Auto-generated fallback previews ("<slug>" stands in for the per-link slug)
  const previews = new Map<string, string>();
  for (const affiliate of affiliates) {
    const preview = await buildAffiliateDestination({
      landingUrl: product.landingUrl,
      affiliateRef: affiliate.handle ?? affiliate.id,
      slug: "SLUG_PLACEHOLDER",
    });
    previews.set(affiliate.id, preview.replace("SLUG_PLACEHOLDER", "<slug>"));
  }

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={`${formatMoney(Number(product.price))} · landing page for every affiliate`}
        action={
          <Link href="/admin/products" className="btn-secondary">
            ← All products
          </Link>
        }
      />

      <Card title="Landing page">
        <p className="text-sm">
          <ExternalLink href={product.landingUrl}>{product.landingUrl}</ExternalLink>
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Campaigns under this product:{" "}
          {product.campaigns.length === 0
            ? "none yet"
            : product.campaigns.map((c) => c.name).join(" · ")}
        </p>
      </Card>

      {/* Per-affiliate destination overrides: set → used VERBATIM by /go,
          cleared → automatic landing-URL builder takes over again. */}
      <Card title="Affiliate destination URLs" className="mt-6" padded={false}>
        <p className="border-b border-ink-800 px-5 py-3 text-xs text-zinc-500">
          A custom URL replaces the automatic redirect destination for that affiliate on this
          product — it is used exactly as entered (no parameters are appended). Leave empty for
          the automatic URL shown as placeholder.
        </p>
        {affiliates.length === 0 ? (
          <EmptyState
            title="No affiliates on this product yet"
            hint="Assign affiliates to a campaign under this product first."
          />
        ) : (
          <ul className="divide-y divide-ink-800">
            {affiliates.map((affiliate) => {
              const override = overrideByAffiliate.get(affiliate.id);
              return (
                <li key={affiliate.id} className="px-5 py-3.5">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">
                        {affiliate.displayName}
                      </span>
                      <code className="text-xs text-zinc-500">
                        {affiliate.handle ?? affiliate.id}
                      </code>
                      <Badge value={override ? "ACTIVE" : "unconfigured"} />
                    </div>
                    {override && (
                      <span className="text-[11px] text-zinc-600">
                        updated {timeAgo(override.updatedAt)}
                      </span>
                    )}
                  </div>
                  <form
                    action={saveAffiliateProductUrl.bind(null, product.id, affiliate.id)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      name="destinationUrl"
                      type="url"
                      className="input min-w-72 flex-1"
                      defaultValue={override?.destinationUrl ?? ""}
                      placeholder={`auto: ${previews.get(affiliate.id)}`}
                      aria-label={`Custom destination URL for ${affiliate.displayName}`}
                    />
                    <button type="submit" className="btn-secondary">
                      Save
                    </button>
                    {override && (
                      <button
                        type="submit"
                        formAction={clearAffiliateProductUrl.bind(null, product.id, affiliate.id)}
                        className="btn-ghost text-red-400"
                      >
                        Clear (use automatic)
                      </button>
                    )}
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
