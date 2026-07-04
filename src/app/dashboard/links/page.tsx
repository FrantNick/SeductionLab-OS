import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackingBaseUrl } from "@/lib/tracking";
import { getConversionsByLink } from "@/lib/analytics";
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
        thread: { select: { id: true, text: true, twitterId: true } },
        _count: { select: { clicks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.campaignAssignment.findMany({
      where: { affiliateId, status: "ACTIVE", campaign: { status: "ACTIVE" } },
      include: { campaign: { select: { id: true, name: true } } },
      orderBy: { campaign: { name: "asc" } },
    }),
  ]);
  const [convByLink, linkBase] = await Promise.all([
    getConversionsByLink(links.map((l) => l.id)),
    trackingBaseUrl(),
  ]);

  return (
    <>
      <PageHeader
        title="Tracking links"
        subtitle="One link per thread — every click and sale is attributed to exactly the thread that earned it."
      />
      <TrackingLinksManager
        links={links.map((l) => {
          const conv = convByLink.get(l.id);
          return {
            id: l.id,
            slug: l.slug,
            url: `${linkBase}/go/${l.slug}`,
            campaignId: l.campaignId,
            campaignName: l.campaign.name,
            createdAt: l.createdAt,
            clicks: l._count.clicks,
            conversions: conv?.count ?? 0,
            revenue: conv?.revenue ?? 0,
            thread: l.thread
              ? {
                  id: l.thread.id,
                  label: l.thread.text
                    ? `${l.thread.text.slice(0, 60)}${l.thread.text.length > 60 ? "…" : ""}`
                    : `Tweet ${l.thread.twitterId}`,
                }
              : null,
          };
        })}
        campaigns={assignments.map((a) => ({ id: a.campaign.id, name: a.campaign.name }))}
      />
    </>
  );
}
