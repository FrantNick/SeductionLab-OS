import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/jobs";
import { executeJob } from "@/lib/job-runs";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Leaderboard job — scheduled every 10 minutes (see vercel.json). */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return jsonError(401, "Unauthorized");

  const outcome = await executeJob("leaderboard", "cron");
  return NextResponse.json({ job: "leaderboard", ...outcome, ranAt: new Date() });
}

export const POST = GET;
