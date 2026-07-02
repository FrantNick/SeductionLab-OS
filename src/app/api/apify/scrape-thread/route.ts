import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api";
import { ApifyError, apifyEnabled, scrapeAndStoreThreadMetrics } from "@/lib/apify";

const scrapeSchema = z.object({
  threadId: z.string().min(1, "threadId is required"),
  twitterUrl: z.string().url().optional(),
});

/**
 * POST /api/apify/scrape-thread — scrapes a thread's metrics via the
 * goat255/twitter-tweet-scraper Apify actor and appends a ThreadMetrics
 * snapshot. Admins can scrape any thread; affiliates only their own.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  const { threadId } = scrapeSchema.parse(await req.json());

  if (!(await apifyEnabled())) {
    return jsonError(503, "Apify is not configured (set APIFY_TOKEN)");
  }

  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread) return jsonError(404, "Thread not found");

  if (session.user.role !== "ADMIN" && thread.affiliateId !== session.user.affiliateId) {
    return jsonError(403, "Forbidden");
  }

  try {
    const snapshot = await scrapeAndStoreThreadMetrics(thread);
    return NextResponse.json({ metrics: snapshot });
  } catch (err) {
    if (err instanceof ApifyError) return jsonError(502, err.message);
    throw err;
  }
});
