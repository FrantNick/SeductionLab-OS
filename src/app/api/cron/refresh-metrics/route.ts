import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron, runMetricsRefresh } from "@/lib/jobs";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Apify refresh job — scheduled every 6 hours (see vercel.json). */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return jsonError(401, "Unauthorized");

  const result = await runMetricsRefresh();
  return NextResponse.json({ job: "refresh-metrics", ...result, ranAt: new Date() });
}

export const POST = GET;
