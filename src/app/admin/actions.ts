"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyAffiliate } from "@/lib/notifications";

// ── Products ─────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(2).max(120),
  price: z.coerce.number().positive(),
  landingUrl: z.string().url(),
});

export async function createProduct(formData: FormData) {
  const session = await requireAdmin();
  const data = productSchema.parse({
    name: formData.get("name"),
    price: formData.get("price"),
    landingUrl: formData.get("landingUrl"),
  });
  const product = await prisma.product.create({ data });
  await logAudit({
    userId: session.user.id,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
    metadata: { name: product.name },
  });
  revalidatePath("/admin/products");
  revalidatePath("/admin/campaigns");
}

export async function updateProduct(productId: string, formData: FormData) {
  const session = await requireAdmin();
  const data = productSchema.parse({
    name: formData.get("name"),
    price: formData.get("price"),
    landingUrl: formData.get("landingUrl"),
  });
  await prisma.product.update({ where: { id: productId }, data });
  await logAudit({
    userId: session.user.id,
    action: "product.updated",
    entityType: "product",
    entityId: productId,
    metadata: { name: data.name },
  });
  revalidatePath("/admin/products");
}

/** Archive hides the product from new campaigns; nothing is deleted. */
export async function setProductArchived(productId: string, archived: boolean) {
  const session = await requireAdmin();
  await prisma.product.update({
    where: { id: productId },
    data: { archivedAt: archived ? new Date() : null },
  });
  await logAudit({
    userId: session.user.id,
    action: archived ? "product.archived" : "product.restored",
    entityType: "product",
    entityId: productId,
  });
  revalidatePath("/admin/products");
}

// ── Campaigns ────────────────────────────────────────────────────────

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
  const session = await requireAdmin();
  const campaign = await prisma.campaign.create({ data: parseCampaignForm(formData) });
  await logAudit({
    userId: session.user.id,
    action: "campaign.created",
    entityType: "campaign",
    entityId: campaign.id,
    metadata: { name: campaign.name },
  });
  revalidatePath("/admin/campaigns");
}

export async function updateCampaign(campaignId: string, formData: FormData) {
  const session = await requireAdmin();
  await prisma.campaign.update({
    where: { id: campaignId },
    data: parseCampaignForm(formData),
  });
  await logAudit({
    userId: session.user.id,
    action: "campaign.updated",
    entityType: "campaign",
    entityId: campaignId,
  });
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function setCampaignStatus(
  campaignId: string,
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED",
) {
  const session = await requireAdmin();
  await prisma.campaign.update({ where: { id: campaignId }, data: { status } });
  await logAudit({
    userId: session.user.id,
    action: "campaign.status_changed",
    entityType: "campaign",
    entityId: campaignId,
    metadata: { status },
  });
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

// ── Assignments ──────────────────────────────────────────────────────

export async function assignAffiliate(campaignId: string, affiliateId: string) {
  const session = await requireAdmin();
  await prisma.campaignAssignment.upsert({
    where: { campaignId_affiliateId: { campaignId, affiliateId } },
    create: { campaignId, affiliateId, status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true },
  });
  await Promise.all([
    logAudit({
      userId: session.user.id,
      action: "assignment.created",
      entityType: "campaign",
      entityId: campaignId,
      metadata: { affiliateId },
    }),
    notifyAffiliate(affiliateId, {
      kind: "SUCCESS",
      title: `You were assigned to "${campaign?.name ?? "a campaign"}"`,
      body: "Open your campaigns to see the playbook and generate a tracking link.",
      href: "/dashboard/campaigns",
    }),
  ]);
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
  const session = await requireAdmin();
  const assignment = await prisma.campaignAssignment.update({
    where: { id: assignmentId },
    data: { status },
  });
  await logAudit({
    userId: session.user.id,
    action: "assignment.status_changed",
    entityType: "assignment",
    entityId: assignmentId,
    metadata: { status },
  });
  revalidatePath(`/admin/campaigns/${assignment.campaignId}`);
}

// ── Affiliates ───────────────────────────────────────────────────────

export async function setAffiliateStatus(
  affiliateId: string,
  status: "ACTIVE" | "PAUSED" | "BANNED",
) {
  const session = await requireAdmin();
  await prisma.affiliate.update({ where: { id: affiliateId }, data: { status } });
  await logAudit({
    userId: session.user.id,
    action: "affiliate.status_changed",
    entityType: "affiliate",
    entityId: affiliateId,
    metadata: { status },
  });
  revalidatePath("/admin/affiliates");
}
