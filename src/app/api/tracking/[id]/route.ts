import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAffiliate } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api";

/**
 * DELETE /api/tracking/[id] — remove one of the caller's tracking links.
 * Only truly unused links can be deleted: no bound thread AND no clicks —
 * deleting a clicked link would cascade-delete its attribution history.
 */
export const DELETE = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { affiliateId } = await requireAffiliate();
    const { id } = await params;

    const link = await prisma.trackingLink.findUnique({
      where: { id },
      include: { _count: { select: { clicks: true } } },
    });
    if (!link || link.affiliateId !== affiliateId) {
      return jsonError(404, "Tracking link not found");
    }
    if (link.threadId) {
      return jsonError(409, "This link is bound to a thread and cannot be deleted");
    }
    if (link._count.clicks > 0) {
      return jsonError(409, "This link already has clicks — deleting it would lose attribution data");
    }

    await prisma.trackingLink.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  },
);
