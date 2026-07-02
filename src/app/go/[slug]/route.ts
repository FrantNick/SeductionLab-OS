import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientCountry, getClientIp, hashIp } from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Public tracking redirect: GET /go/{slug}
 * Logs the click (with hashed IP) and 302-redirects to the destination URL.
 * Tracking integrity: every click stores trackingLinkId, affiliateId, campaignId.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const link = await prisma.trackingLink.findUnique({ where: { slug } });
  if (!link) {
    return new NextResponse("Link not found", { status: 404 });
  }

  const ip = getClientIp(req.headers);
  const userAgent = req.headers.get("user-agent") ?? "";
  const country = getClientCountry(req.headers);

  try {
    await prisma.click.create({
      data: {
        trackingLinkId: link.id,
        affiliateId: link.affiliateId,
        campaignId: link.campaignId,
        ipHash: hashIp(ip),
        userAgent: userAgent.slice(0, 500),
        country,
      },
    });
  } catch (err) {
    // A failed log must never block the visitor's redirect.
    console.error("[go] click logging failed", err);
  }

  return NextResponse.redirect(link.destinationUrl, { status: 302 });
}
