import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { jsonError, withErrorHandling } from "@/lib/api";
import { executeJob, getJobStatus, JOB_DEFS } from "@/lib/job-runs";
import { logAudit } from "@/lib/audit";

export const maxDuration = 300;

/** GET /api/admin/jobs — cron/job status for the debug panel. */
export const GET = withErrorHandling(async () => {
  await requireAdmin();
  const status = await getJobStatus();
  return NextResponse.json(status);
});

const runSchema = z.object({
  job: z.enum(["leaderboard", "refresh-metrics", "all"]),
});

/** POST /api/admin/jobs — manually trigger one job (or all). */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAdmin();
  const { job } = runSchema.parse(await req.json());

  const jobs = job === "all" ? JOB_DEFS.map((j) => j.name) : [job];
  const results = [];
  for (const name of jobs) {
    results.push({ job: name, ...(await executeJob(name, "manual")) });
  }

  await logAudit({
    userId: session.user.id,
    action: "job.triggered",
    entityType: "job",
    entityId: job,
    metadata: { results: results.map((r) => ({ job: r.job, status: r.status })) },
  });

  const failed = results.find((r) => r.status === "FAILED");
  if (failed) return jsonError(500, `${failed.job} failed: ${failed.error}`);
  return NextResponse.json({ results });
});
