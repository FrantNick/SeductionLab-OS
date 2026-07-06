import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAffiliate } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api";
import { buildAffiliateDestination, fullTrackingUrl, generateSlug } from "@/lib/tracking";

const generateSchema = z.object({
  campaignId: z.string().min(1, "campaignId is required"),
  productId: z.string().min(1).optional(),
  // planned-thread metadata — copied to the Thread at submission time
  threadName: z.string().trim().max(120).optional(),
  threadDescription: z.string().trim().max(2000).optional(),
});

/**
 * POST /api/tracking/generate — affiliate creates a NEW tracking link for
 * a campaign they are assigned to. Every call mints a fresh slug: links
 * are per-thread, so an affiliate creates one before each thread they
 * post and later binds it to the submitted thread (POST /api/threads).
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const { affiliateId } = await requireAffiliate();
  const { campaignId, productId, threadName, threadDescription } = generateSchema.parse(
    await req.json(),
  );

  const assignment = await prisma.campaignAssignment.findUnique({
    where: { campaignId_affiliateId: { campaignId, affiliateId } },
    include: { campaign: { include: { product: true } } },
  });
  if (!assignment || assignment.status !== "ACTIVE") {
    return jsonError(403, "You are not assigned to this campaign");
  }

  const campaign = assignment.campaign;
  // The campaign's product is the default; an explicit productId must match it.
  const resolvedProductId = productId ?? campaign.productId;
  if (resolvedProductId !== campaign.productId) {
    return jsonError(400, "productId does not match the campaign's product");
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { handle: true },
  });

  const slug = generateSlug();
  const link = await prisma.trackingLink.create({
    data: {
      affiliateId,
      campaignId,
      productId: resolvedProductId,
      slug,
      threadName: threadName || null,
      threadDescription: threadDescription || null,
      // snapshot of the landing destination; /go recomputes it live so
      // later product/setting changes reach existing links too
      destinationUrl: await buildAffiliateDestination({
        landingUrl: campaign.product.landingUrl,
        affiliateRef: affiliate?.handle ?? affiliateId,
        slug,
      }),
    },
  });

  return NextResponse.json({ link, url: await fullTrackingUrl(link.slug) }, { status: 201 });
});
