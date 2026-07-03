"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { buildAffiliateDestination, generateSlug } from "@/lib/tracking";

/**
 * Debug tool: create a fresh tracking link for any affiliate × campaign
 * pair — same semantics as the affiliate API (links are per-thread, so a
 * new slug is minted every time), without the self-assignment requirement.
 */
export async function generateTestLink(formData: FormData) {
  await requireAdmin();
  const affiliateId = z.string().min(1).parse(formData.get("affiliateId"));
  const campaignId = z.string().min(1).parse(formData.get("campaignId"));

  const [campaign, affiliate] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId }, include: { product: true } }),
    prisma.affiliate.findUnique({ where: { id: affiliateId }, select: { handle: true } }),
  ]);
  if (!campaign) throw new Error("Campaign not found");

  const slug = generateSlug();
  await prisma.trackingLink.create({
    data: {
      affiliateId,
      campaignId,
      productId: campaign.productId,
      slug,
      destinationUrl: await buildAffiliateDestination({
        landingUrl: campaign.product.landingUrl,
        affiliateRef: affiliate?.handle ?? affiliateId,
        slug,
      }),
    },
  });
  revalidatePath("/admin/debug");
}
