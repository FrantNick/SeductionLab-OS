import { NotificationKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Persistent in-app notifications (distinct from client toasts, which are
 * ephemeral). Every important platform event should call notify() so the
 * affected user sees it in their notification feed.
 */
export async function notify(entry: {
  userId: string;
  kind?: NotificationKind;
  title: string;
  body?: string;
  href?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: entry.userId,
        kind: entry.kind ?? "INFO",
        title: entry.title,
        body: entry.body ?? "",
        href: entry.href,
      },
    });
  } catch (err) {
    // Notifications are best-effort; never break the triggering action.
    console.error("[notify] failed", entry.title, err);
  }
}

/** Notify the user behind an affiliate profile (no-op if missing). */
export async function notifyAffiliate(
  affiliateId: string,
  entry: { kind?: NotificationKind; title: string; body?: string; href?: string },
): Promise<void> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { userId: true },
  });
  if (affiliate) await notify({ userId: affiliate.userId, ...entry });
}

export async function getNotifications(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
