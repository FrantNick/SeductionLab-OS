import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { getNotifications, markAllRead } from "@/lib/notifications";

/** GET /api/notifications — the caller's recent notifications. */
export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const notifications = await getNotifications(session.user.id);
  return NextResponse.json({
    notifications,
    unread: notifications.filter((n) => !n.readAt).length,
  });
});

/** POST /api/notifications — mark all as read. */
export const POST = withErrorHandling(async () => {
  const session = await requireSession();
  await markAllRead(session.user.id);
  return NextResponse.json({ ok: true });
});
