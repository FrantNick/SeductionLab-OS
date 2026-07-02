import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAffiliate } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api";

const linkSchema = z.object({
  trackingLinkId: z.string().min(1, "trackingLinkId is required"),
});

/**
 * POST /api/threads/[id]/link — bind a tracking link to an existing
 * thread that has none. Exists for threads submitted before per-thread
 * links (migration left their links with threadId = NULL) — new threads
 * are bound at submission time and can't be re-bound.
 */
export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { affiliateId } = await requireAffiliate();
    const { id: threadId } = await params;
    const { trackingLinkId } = linkSchema.parse(await req.json());

    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      include: { trackingLink: { select: { id: true } } },
    });
    if (!thread || thread.affiliateId !== affiliateId) {
      return jsonError(404, "Thread not found");
    }
    if (thread.trackingLink) {
      return jsonError(409, "This thread already has a tracking link");
    }

    const link = await prisma.trackingLink.findUnique({ where: { id: trackingLinkId } });
    if (!link || link.affiliateId !== affiliateId) {
      return jsonError(404, "Tracking link not found");
    }
    if (link.campaignId !== thread.campaignId) {
      return jsonError(400, "That tracking link belongs to a different campaign");
    }

    // threadId: null guard = race-safe consume (same pattern as submission)
    const bound = await prisma.trackingLink.updateMany({
      where: { id: trackingLinkId, threadId: null },
      data: { threadId },
    });
    if (bound.count === 0) {
      return jsonError(409, "That tracking link is already bound to another thread");
    }

    return NextResponse.json({ linked: true });
  },
);
