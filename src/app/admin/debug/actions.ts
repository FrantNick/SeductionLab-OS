"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { buildDestinationUrl, generateSlug } from "@/lib/tracking";

/**
 * Debug tool: generate (or fetch the existing) tracking link for any
 * affiliate × campaign pair — same semantics as the affiliate API,
 * without the self-assignment requirement.
 */
export async function generateTestLink(formData: FormData) {
  await requireAdmin();
  const affiliateId = z.string().min(1).parse(formData.get("affiliateId"));
  const campaignId = z.string().min(1).parse(formData.get("campaignId"));

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { product: true },
  });
  if (!campaign) throw new Error("Campaign not found");

  const existing = await prisma.trackingLink.findFirst({
    where: { affiliateId, campaignId, productId: campaign.productId },
  });
  if (!existing) {
    const slug = generateSlug();
    await prisma.trackingLink.create({
      data: {
        affiliateId,
        campaignId,
        productId: campaign.productId,
        slug,
        destinationUrl: buildDestinationUrl(campaign.product.checkoutUrl, {
          slug,
          campaignId,
          affiliateId,
        }),
      },
    });
  }
  revalidatePath("/admin/debug");
}
