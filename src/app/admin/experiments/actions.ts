"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyAffiliate } from "@/lib/notifications";

const experimentSchema = z.object({
  name: z.string().min(2).max(120),
  campaignId: z.string().min(1),
  goal: z.string().max(500).default(""),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.enum(["DRAFT", "RUNNING", "COMPLETED", "CANCELLED"]).default("DRAFT"),
});

export async function createExperiment(formData: FormData) {
  const session = await requireAdmin();
  const data = experimentSchema.parse({
    name: formData.get("name"),
    campaignId: formData.get("campaignId"),
    goal: formData.get("goal") ?? "",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    status: formData.get("status") ?? "DRAFT",
  });

  const campaign = await prisma.campaign.findUnique({ where: { id: data.campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  const experiment = await prisma.experiment.create({
    data: {
      name: data.name,
      campaignId: data.campaignId,
      productId: campaign.productId, // product follows the campaign
      goal: data.goal,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: data.status,
    },
  });
  await logAudit({
    userId: session.user.id,
    action: "experiment.created",
    entityType: "experiment",
    entityId: experiment.id,
    metadata: { name: experiment.name },
  });
  revalidatePath("/admin/experiments");
}

export async function setExperimentStatus(
  experimentId: string,
  status: "DRAFT" | "RUNNING" | "COMPLETED" | "CANCELLED",
) {
  const session = await requireAdmin();
  await prisma.experiment.update({ where: { id: experimentId }, data: { status } });
  await logAudit({
    userId: session.user.id,
    action: "experiment.status_changed",
    entityType: "experiment",
    entityId: experimentId,
    metadata: { status },
  });
  revalidatePath("/admin/experiments");
  revalidatePath(`/admin/experiments/${experimentId}`);
}

export async function assignToExperiment(experimentId: string, formData: FormData) {
  await requireAdmin();
  const affiliateId = z.string().min(1).parse(formData.get("affiliateId"));

  const experiment = await prisma.experiment.findUnique({ where: { id: experimentId } });
  if (!experiment) throw new Error("Experiment not found");

  await prisma.experimentAssignment.upsert({
    where: { experimentId_affiliateId: { experimentId, affiliateId } },
    create: { experimentId, affiliateId },
    update: {},
  });
  await notifyAffiliate(affiliateId, {
    kind: "INFO",
    title: `You joined experiment "${experiment.name}"`,
    body: experiment.goal || "Check your dashboard for the active experiments panel.",
    href: "/dashboard",
  });
  revalidatePath(`/admin/experiments/${experimentId}`);
}

export async function removeFromExperiment(assignmentId: string) {
  await requireAdmin();
  const assignment = await prisma.experimentAssignment.delete({ where: { id: assignmentId } });
  revalidatePath(`/admin/experiments/${assignment.experimentId}`);
}

export async function declareWinner(experimentId: string, affiliateId: string) {
  const session = await requireAdmin();
  await prisma.experiment.update({
    where: { id: experimentId },
    data: { winnerAffiliateId: affiliateId, status: "COMPLETED" },
  });
  await Promise.all([
    logAudit({
      userId: session.user.id,
      action: "experiment.status_changed",
      entityType: "experiment",
      entityId: experimentId,
      metadata: { status: "COMPLETED", winnerAffiliateId: affiliateId },
    }),
    notifyAffiliate(affiliateId, {
      kind: "SUCCESS",
      title: "You won an experiment 🏆",
      body: "An admin declared you the winner. Nice work.",
      href: "/dashboard",
    }),
  ]);
  revalidatePath(`/admin/experiments/${experimentId}`);
  revalidatePath("/admin/experiments");
}
