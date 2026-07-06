import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAffiliate } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api";

const metaSchema = z.object({
  threadName: z.string().trim().max(120).optional(),
  threadDescription: z.string().trim().max(2000).optional(),
});

/**
 * PATCH /api/threads/[id] — edit a thread's name/description after
 * submission (owner only). Empty strings clear a field back to null.
 */
export const PATCH = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { affiliateId } = await requireAffiliate();
    const { id } = await params;
    const data = metaSchema.parse(await req.json());

    const thread = await prisma.thread.findUnique({ where: { id }, select: { affiliateId: true } });
    if (!thread || thread.affiliateId !== affiliateId) {
      return jsonError(404, "Thread not found");
    }

    const updated = await prisma.thread.update({
      where: { id },
      data: {
        ...(data.threadName !== undefined ? { threadName: data.threadName || null } : {}),
        ...(data.threadDescription !== undefined
          ? { threadDescription: data.threadDescription || null }
          : {}),
      },
      select: { id: true, threadName: true, threadDescription: true },
    });

    return NextResponse.json({ thread: updated });
  },
);
