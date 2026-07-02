"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const profileSchema = z.object({
  displayName: z.string().min(2).max(50),
  avatarUrl: z.union([z.literal(""), z.string().url()]),
  timezone: z.string().max(64),
});

export async function updateProfile(formData: FormData) {
  const session = await requireSession();
  if (!session.user.affiliateId) throw new Error("No affiliate profile");

  const data = profileSchema.parse({
    displayName: formData.get("displayName"),
    avatarUrl: formData.get("avatarUrl") ?? "",
    timezone: formData.get("timezone") ?? "",
  });

  await prisma.affiliate.update({
    where: { id: session.user.affiliateId },
    data: {
      displayName: data.displayName,
      avatarUrl: data.avatarUrl || null,
      timezone: data.timezone || null,
    },
  });
  await logAudit({
    userId: session.user.id,
    action: "affiliate.settings_changed",
    entityType: "affiliate",
    entityId: session.user.affiliateId,
  });
  revalidatePath("/dashboard/settings");
}

export async function updateNotificationPrefs(formData: FormData) {
  const session = await requireSession();
  if (!session.user.affiliateId) throw new Error("No affiliate profile");

  const prefs = {
    onAssignment: formData.get("onAssignment") === "on",
    onConversion: formData.get("onConversion") === "on",
    onLeaderboard: formData.get("onLeaderboard") === "on",
  };
  await prisma.affiliate.update({
    where: { id: session.user.affiliateId },
    data: { notificationPrefs: prefs },
  });
  revalidatePath("/dashboard/settings");
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export async function changePassword(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireSession();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "User not found" };

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!valid) return { error: "Current password is incorrect" };

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(parsed.data.newPassword, 12) },
  });
  await logAudit({
    userId: user.id,
    action: "user.password_changed",
    entityType: "user",
    entityId: user.id,
  });
  return { ok: true };
}
