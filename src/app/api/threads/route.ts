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
});

/**
 * POST /api/threads — affiliate submits the URL of a posted Twitter/X thread.
 * If Apify is configured, an initial metrics scrape is kicked off immediately.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const { affiliateId } = await requireAffiliate();
  const { campaignId, twitterUrl } = submitSchema.parse(await req.json());

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

  const duplicate = await prisma.thread.findUnique({
    where: { affiliateId_twitterId: { affiliateId, twitterId } },
  });
  if (duplicate) return jsonError(409, "You already submitted this thread");

  const thread = await prisma.thread.create({
    data: {
      affiliateId,
      campaignId,
      twitterUrl: normalizeTweetUrl(twitterUrl),
      twitterId,
    },
  });

  // Initial scrape (best-effort): submission must succeed even if Apify fails.
  let initialScrape: "ok" | "failed" | "disabled" = "disabled";
  if (apifyEnabled()) {
    try {
      await scrapeAndStoreThreadMetrics(thread);
      initialScrape = "ok";
    } catch (err) {
      console.error("[threads] initial scrape failed", err);
      initialScrape = "failed";
    }
  }

  return NextResponse.json({ thread, initialScrape }, { status: 201 });
});

/** GET /api/threads — the calling affiliate's threads with latest metrics. */
export const GET = withErrorHandling(async () => {
  const { affiliateId } = await requireAffiliate();

  const threads = await prisma.thread.findMany({
    where: { affiliateId },
    include: {
      campaign: { select: { id: true, name: true } },
      metrics: { orderBy: { scrapedAt: "desc" }, take: 1 },
    },
    orderBy: { postedAt: "desc" },
  });

  return NextResponse.json({ threads });
});
