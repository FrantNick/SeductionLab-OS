"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const productSchema = z.object({
  name: z.string().min(2).max(120),
  price: z.coerce.number().positive(),
  checkoutUrl: z.string().url(),
});

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const data = productSchema.parse({
    name: formData.get("name"),
    price: formData.get("price"),
    checkoutUrl: formData.get("checkoutUrl"),
  });
  await prisma.product.create({ data });
  revalidatePath("/admin/products");
  revalidatePath("/admin/campaigns");
}

const campaignSchema = z.object({
  name: z.string().min(2).max(120),
  productId: z.string().min(1),
  angle: z.string().min(2),
  instructions: z.string().default(""),
  exampleHook: z.string().default(""),
  exampleCTA: z.string().default(""),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).default("DRAFT"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

function parseCampaignForm(formData: FormData) {
  const data = campaignSchema.parse({
    name: formData.get("name"),
    productId: formData.get("productId"),
    angle: formData.get("angle"),
    instructions: formData.get("instructions") ?? "",
    exampleHook: formData.get("exampleHook") ?? "",
    exampleCTA: formData.get("exampleCTA") ?? "",
    status: formData.get("status") ?? "DRAFT",
    startDate: (formData.get("startDate") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
  });
  return {
    ...data,
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
  };
}

export async function createCampaign(formData: FormData) {
  await requireAdmin();
  await prisma.campaign.create({ data: parseCampaignForm(formData) });
  revalidatePath("/admin/campaigns");
}

export async function updateCampaign(campaignId: string, formData: FormData) {
  await requireAdmin();
  await prisma.campaign.update({
    where: { id: campaignId },
    data: parseCampaignForm(formData),
  });
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function setCampaignStatus(
  campaignId: string,
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED",
) {
  await requireAdmin();
  await prisma.campaign.update({ where: { id: campaignId }, data: { status } });
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function assignAffiliate(campaignId: string, affiliateId: string) {
  await requireAdmin();
  await prisma.campaignAssignment.upsert({
    where: { campaignId_affiliateId: { campaignId, affiliateId } },
    create: { campaignId, affiliateId, status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

/** Form-friendly variant: affiliateId comes from a <select name="affiliateId">. */
export async function assignAffiliateForm(campaignId: string, formData: FormData) {
  const affiliateId = z.string().min(1).parse(formData.get("affiliateId"));
  await assignAffiliate(campaignId, affiliateId);
}

export async function setAssignmentStatus(
  assignmentId: string,
  status: "ACTIVE" | "PAUSED" | "REMOVED",
) {
  await requireAdmin();
  const assignment = await prisma.campaignAssignment.update({
    where: { id: assignmentId },
    data: { status },
  });
  revalidatePath(`/admin/campaigns/${assignment.campaignId}`);
}

export async function setAffiliateStatus(
  affiliateId: string,
  status: "ACTIVE" | "PAUSED" | "BANNED",
) {
  await requireAdmin();
  await prisma.affiliate.update({ where: { id: affiliateId }, data: { status } });
  revalidatePath("/admin/affiliates");
}
