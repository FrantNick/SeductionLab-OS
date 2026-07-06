import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/app-settings";
import {
  buildAffiliateDestination,
  getClientCountry,
  getClientIp,
  hashIp,
} from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Public tracking redirect: GET /go/{slug}
 * Logs the click (with hashed IP) and 302-redirects to the destination.
 * Tracking integrity: every click stores trackingLinkId, affiliateId,
 * campaignId (and reaches the thread via the link's 1:1 binding).
 *
 * Destination resolution order:
 *   1. AffiliateProductUrl override (admin-set, used VERBATIM)
 *   2. buildAffiliateDestination() — landing URL + configured params
 *   3. the destinationUrl snapshot stored on the link (last resort)
 *
 * Bot filter: X's preview bots hammer links right after a thread goes up,
 * so clicks arriving within tracking.botFilterMinutes of the linked
 * thread's submission are NOT logged. The visitor is always redirected —
 * filtering only affects analytics, never the redirect.
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
      thread: { select: { createdAt: true } },
    },
  });
  if (!link) {
    return new NextResponse("Link not found", { status: 404 });
  }

  let withinBotWindow = false;
  try {
    const minutes = Number(await getSetting("tracking.botFilterMinutes")) || 0;
    withinBotWindow =
      minutes > 0 &&
      link.thread !== null &&
      Date.now() - link.thread.createdAt.getTime() < minutes * 60_000;
  } catch (err) {
    console.error("[go] bot-filter check failed, logging click normally", err);
  }

  if (!withinBotWindow) {
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
  }

  // Destination is computed at redirect time so overrides, landing-URL and
  // parameter changes apply to every existing link immediately; the
  // snapshot stored on the link is only the fallback if that fails.
  let destination = link.destinationUrl;
  try {
    const override = await prisma.affiliateProductUrl.findUnique({
      where: {
        affiliateId_productId: { affiliateId: link.affiliateId, productId: link.productId },
      },
    });
    destination = override
      ? override.destinationUrl // admin-set URL, used verbatim — no param building
      : await buildAffiliateDestination({
          landingUrl: link.product.landingUrl,
          affiliateRef: link.affiliate.handle ?? link.affiliateId,
          slug: link.slug,
        });
  } catch (err) {
    console.error("[go] destination build failed, using stored snapshot", err);
  }

  return NextResponse.redirect(destination, { status: 302 });
}
