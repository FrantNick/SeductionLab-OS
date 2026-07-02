import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fullTrackingUrl } from "@/lib/tracking";
import { PageHeader } from "@/components/ui";
import { TrackingLinksManager } from "@/components/tracking-links-manager";

export const dynamic = "force-dynamic";

export default async function TrackingLinksPage() {
  const session = await auth();
  const affiliateId = session?.user.affiliateId;
  if (!affiliateId) redirect("/dashboard");

  const [links, assignments] = await Promise.all([
    prisma.trackingLink.findMany({
      where: { affiliateId },
      include: {
        campaign: { select: { name: true } },
        product: { select: { name: true } },
        _count: { select: { clicks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.campaignAssignment.findMany({
      where: { affiliateId, status: "ACTIVE", campaign: { status: "ACTIVE" } },
      include: { campaign: { include: { product: { select: { id: true, name: true } } } } },
      orderBy: { campaign: { name: "asc" } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Tracking links"
        subtitle="Every click through these links is logged with campaign and affiliate attribution."
      />
      <TrackingLinksManager
        links={links.map((l) => ({
          id: l.id,
          slug: l.slug,
          url: fullTrackingUrl(l.slug),
          campaignId: l.campaignId,
          campaignName: l.campaign.name,
          productName: l.product.name,
          clicks: l._count.clicks,
          createdAt: l.createdAt,
        }))}
        campaigns={assignments.map((a) => ({
          id: a.campaign.id,
          name: a.campaign.name,
          productId: a.campaign.product.id,
          productName: a.campaign.product.name,
        }))}
      />
    </>
  );
}
