import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAffiliate } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api";
import { normalizeTweetUrl, parseTweetId } from "@/lib/twitter";
import { apifyEnabled, scrapeAndStoreThreadMetrics } from "@/lib/apify";

const submitSchema = z.object({
  campaignId: z.string().min(1, "campaignId is required"),
  twitterUrl: z.string().url("A valid tweet URL is required"),
  trackingLinkId: z.string().min(1, "trackingLinkId is required"),
  threadName: z.string().trim().max(120).optional(),
  threadDescription: z.string().trim().max(2000).optional(),
});

/**
 * POST /api/threads — affiliate submits the URL of a posted Twitter/X
 * thread together with the tracking link the thread promotes. The link is
 * bound to the thread permanently (1 thread ↔ 1 link), which is what makes
 * per-thread click attribution exact.
 * If Apify is configured, an initial metrics scrape is kicked off.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const { affiliateId } = await requireAffiliate();
  const { campaignId, twitterUrl, trackingLinkId, threadName, threadDescription } =
    submitSchema.parse(await req.json());

  const twitterId = parseTweetId(twitterUrl);
  if (!twitterId) {
    return jsonError(400, "URL must be a tweet permalink like https://x.com/user/status/123");
  }

  const assignment = await prisma.campaignAssignment.findUnique({
    where: { campaignId_affiliateId: { campaignId, affiliateId } },
  });
  if (!assignment || assignment.status !== "ACTIVE") {
    return jsonError(403, "You are not assigned to this campaign");
  }

  const link = await prisma.trackingLink.findUnique({ where: { id: trackingLinkId } });
  if (!link || link.affiliateId !== affiliateId) {
    return jsonError(404, "Tracking link not found");
  }
  if (link.campaignId !== campaignId) {
    return jsonError(400, "That tracking link belongs to a different campaign");
  }
  if (link.threadId) {
    return jsonError(409, "That tracking link is already bound to another thread");
  }

  const duplicate = await prisma.thread.findUnique({
    where: { affiliateId_twitterId: { affiliateId, twitterId } },
  });
  if (duplicate) return jsonError(409, "You already submitted this thread");

  // Create the thread and consume the link atomically. updateMany's
  // threadId: null guard makes the bind race-safe: a concurrent submission
  // of the same link changes zero rows and rolls the whole thing back.
  const thread = await prisma.$transaction(async (tx) => {
    const created = await tx.thread.create({
      data: {
        affiliateId,
        campaignId,
        twitterUrl: normalizeTweetUrl(twitterUrl),
        twitterId,
        // submission values win; otherwise inherit what the affiliate
        // planned when creating the tracking link
        threadName: threadName || link.threadName || null,
        threadDescription: threadDescription || link.threadDescription || null,
      },
    });
    const bound = await tx.trackingLink.updateMany({
      where: { id: trackingLinkId, threadId: null },
      data: { threadId: created.id },
    });
    if (bound.count === 0) {
      throw new Error("Tracking link was just used by another submission — pick another link");
    }
    return created;
  });

  // Initial scrape (best-effort): submission must succeed even if Apify fails.
  let initialScrape: "ok" | "failed" | "disabled" = "disabled";
  let scrapeError: string | null = null;
  if (await apifyEnabled()) {
    try {
      await scrapeAndStoreThreadMetrics(thread);
      initialScrape = "ok";
    } catch (err) {
      console.error("[threads] initial scrape failed", err);
      initialScrape = "failed";
      scrapeError = err instanceof Error ? err.message : "Unknown scrape error";
    }
  }

  return NextResponse.json({ thread, initialScrape, scrapeError }, { status: 201 });
});

/** GET /api/threads — the calling affiliate's threads with latest metrics. */
export const GET = withErrorHandling(async () => {
  const { affiliateId } = await requireAffiliate();

  const threads = await prisma.thread.findMany({
    where: { affiliateId },
    include: {
      campaign: { select: { id: true, name: true } },
      trackingLink: { select: { id: true, slug: true, _count: { select: { clicks: true } } } },
      metrics: { orderBy: { scrapedAt: "desc" }, take: 1 },
    },
    orderBy: { postedAt: "desc" },
  });

  return NextResponse.json({ threads });
});
