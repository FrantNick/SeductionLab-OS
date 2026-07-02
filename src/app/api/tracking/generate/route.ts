import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAffiliate } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api";
import { buildDestinationUrl, fullTrackingUrl, generateSlug } from "@/lib/tracking";

const generateSchema = z.object({
  campaignId: z.string().min(1, "campaignId is required"),
  productId: z.string().min(1).optional(),
});

/**
 * POST /api/tracking/generate — affiliate generates a tracking link
 * for a campaign they are assigned to. Returns the full /go/{slug} URL.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const { affiliateId } = await requireAffiliate();
  const { campaignId, productId } = generateSchema.parse(await req.json());

  const assignment = await prisma.campaignAssignment.findUnique({
    where: { campaignId_affiliateId: { campaignId, affiliateId } },
    include: { campaign: { include: { product: true } } },
  });
  if (!assignment || assignment.status !== "ACTIVE") {
    return jsonError(403, "You are not assigned to this campaign");
  }

  const campaign = assignment.campaign;
  // The campaign's product is the default; an explicit productId must match it in V1.
  const resolvedProductId = productId ?? campaign.productId;
  if (resolvedProductId !== campaign.productId) {
    return jsonError(400, "productId does not match the campaign's product");
  }

  // Reuse an existing link for the same (affiliate, campaign, product) —
  // one canonical link keeps click data consolidated.
  const existing = await prisma.trackingLink.findFirst({
    where: { affiliateId, campaignId, productId: resolvedProductId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    return NextResponse.json({
      link: existing,
      url: fullTrackingUrl(existing.slug),
      reused: true,
    });
  }

  const slug = generateSlug();
  const link = await prisma.trackingLink.create({
    data: {
      affiliateId,
      campaignId,
      productId: resolvedProductId,
      slug,
      destinationUrl: buildDestinationUrl(campaign.product.checkoutUrl, {
        slug,
        campaignId,
        affiliateId,
      }),
    },
  });

  return NextResponse.json(
    { link, url: fullTrackingUrl(link.slug), reused: false },
    { status: 201 },
  );
});
