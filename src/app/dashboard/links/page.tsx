import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fullTrackingUrl } from "@/lib/tracking";
import { formatDate, formatNumber } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

export default async function TrackingLinksPage() {
  const session = await auth();
  const affiliateId = session?.user.affiliateId;
  if (!affiliateId) redirect("/dashboard");

  const links = await prisma.trackingLink.findMany({
    where: { affiliateId },
    include: {
      campaign: { select: { name: true } },
      product: { select: { name: true } },
      _count: { select: { clicks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Tracking links"
        subtitle="Every click through these links is logged with campaign and affiliate attribution."
      />

      <Card padded={false}>
        {links.length === 0 ? (
          <EmptyState
            title="No tracking links yet"
            hint="Generate one from the Campaigns page."
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Link</th>
                <th>Campaign</th>
                <th>Product</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">Created</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const url = fullTrackingUrl(link.slug);
                return (
                  <tr key={link.id}>
                    <td>
                      <code className="text-xs text-ember-text">{url}</code>
                    </td>
                    <td className="text-zinc-400">{link.campaign.name}</td>
                    <td className="text-zinc-400">{link.product.name}</td>
                    <td className="num text-right font-medium text-zinc-200">
                      {formatNumber(link._count.clicks)}
                    </td>
                    <td className="text-right text-xs text-zinc-500">
                      {formatDate(link.createdAt)}
                    </td>
                    <td className="text-right">
                      <CopyButton text={url} />
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
