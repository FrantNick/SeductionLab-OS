import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAffiliateDestination,
  getClientCountry,
  getClientIp,
  hashIp,
} from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Public tracking redirect: GET /go/{slug}
 * Logs the click (with hashed IP) and 302-redirects to the product's
 * landing page with affiliate/tracking params appended.
 * Tracking integrity: every click stores trackingLinkId, affiliateId,
 * campaignId (and reaches the thread via the link's 1:1 binding).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const link = await prisma.trackingLink.findUnique({
    where: { slug },
    include: {
      product: { select: { landingUrl: true } },
      affiliate: { select: { handle: true } },
    },
  });
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

  // Destination is computed at redirect time so landing-URL and parameter
  // changes apply to every existing link immediately; the snapshot stored
  // on the link is only the fallback if that computation fails.
  let destination = link.destinationUrl;
  try {
    destination = await buildAffiliateDestination({
      landingUrl: link.product.landingUrl,
      affiliateRef: link.affiliate.handle ?? link.affiliateId,
      slug: link.slug,
    });
  } catch (err) {
    console.error("[go] destination build failed, using stored snapshot", err);
  }

  return NextResponse.redirect(destination, { status: 302 });
}
