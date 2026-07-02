import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron, runLeaderboardRefresh } from "@/lib/jobs";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Leaderboard job — scheduled every 10 minutes (see vercel.json). */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return jsonError(401, "Unauthorized");

  const result = await runLeaderboardRefresh();
  return NextResponse.json({ job: "leaderboard", ...result, ranAt: new Date() });
}

export const POST = GET;
