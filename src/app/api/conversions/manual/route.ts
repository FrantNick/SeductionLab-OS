import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyAffiliate } from "@/lib/notifications";

const conversionSchema = z.object({
  affiliateId: z.string().min(1, "affiliateId is required"),
  campaignId: z.string().min(1, "campaignId is required"),
  revenue: z.coerce.number().positive("revenue must be > 0"),
  productId: z.string().min(1).optional(),
  sourceClickId: z.string().min(1).optional(),
});

/**
 * POST /api/conversions/manual — V1 revenue entry (admin only).
 * The product defaults to the campaign's product when not supplied.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAdmin();
  const input = conversionSchema.parse(await req.json());

  const campaign = await prisma.campaign.findUnique({ where: { id: input.campaignId } });
  if (!campaign) return jsonError(404, "Campaign not found");

  const affiliate = await prisma.affiliate.findUnique({ where: { id: input.affiliateId } });
  if (!affiliate) return jsonError(404, "Affiliate not found");

  if (input.sourceClickId) {
    const click = await prisma.click.findUnique({ where: { id: input.sourceClickId } });
    if (!click) return jsonError(404, "sourceClickId not found");
    if (click.affiliateId !== input.affiliateId || click.campaignId !== input.campaignId) {
      return jsonError(400, "sourceClickId belongs to a different affiliate/campaign");
    }
  }

  const conversion = await prisma.conversion.create({
    data: {
      affiliateId: input.affiliateId,
      campaignId: input.campaignId,
      productId: input.productId ?? campaign.productId,
      revenue: input.revenue,
      sourceClickId: input.sourceClickId,
    },
  });

  await Promise.all([
    logAudit({
      userId: session.user.id,
      action: "conversion.created",
      entityType: "conversion",
      entityId: conversion.id,
      metadata: { revenue: input.revenue, campaignId: input.campaignId },
    }),
    notifyAffiliate(input.affiliateId, {
      kind: "SUCCESS",
      title: `Sale recorded: $${input.revenue.toFixed(2)}`,
      body: `Campaign: ${campaign.name}`,
      href: "/dashboard",
    }),
  ]);

  return NextResponse.json({ conversion }, { status: 201 });
});
