import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/jobs";
import { executeJob } from "@/lib/job-runs";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Apify refresh job — scheduled every 6 hours (see vercel.json). */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return jsonError(401, "Unauthorized");

  const outcome = await executeJob("refresh-metrics", "cron");
  return NextResponse.json({ job: "refresh-metrics", ...outcome, ranAt: new Date() });
}

export const POST = GET;
