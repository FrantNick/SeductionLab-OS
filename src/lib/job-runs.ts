import { prisma } from "@/lib/prisma";
import { runLeaderboardRefresh, runMetricsRefresh } from "@/lib/jobs";

/**
 * Job execution wrapper: every run (cron or manual) is recorded as a
 * JobRun row, which powers cron status, health checks and the recent-
 * errors view in the admin debug panel.
 */

export const JOB_DEFS = [
  {
    name: "leaderboard",
    label: "Leaderboard refresh",
    schedule: "*/10 * * * *",
    cadence: "every 10 minutes",
    run: runLeaderboardRefresh,
  },
  {
    name: "refresh-metrics",
    label: "Apify metrics refresh",
    schedule: "0 */6 * * *",
    cadence: "every 6 hours",
    run: runMetricsRefresh,
  },
] as const;

export type JobName = (typeof JOB_DEFS)[number]["name"];

export async function executeJob(
  name: JobName,
  trigger: "cron" | "manual",
): Promise<{ runId: string; status: "SUCCESS" | "FAILED"; result?: unknown; error?: string }> {
  const def = JOB_DEFS.find((j) => j.name === name);
  if (!def) throw new Error(`Unknown job: ${name}`);

  const run = await prisma.jobRun.create({ data: { job: name, trigger } });

  try {
    const result = await def.run();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", result: result as object, finishedAt: new Date() },
    });
    return { runId: run.id, status: "SUCCESS", result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message.slice(0, 2000), finishedAt: new Date() },
    });
    return { runId: run.id, status: "FAILED", error: message };
  }
}

/** Latest run per job + recent failures (debug panel / settings). */
export async function getJobStatus() {
  const [latest, failures] = await Promise.all([
    Promise.all(
      JOB_DEFS.map(async (def) => ({
        ...def,
        lastRun: await prisma.jobRun.findFirst({
          where: { job: def.name },
          orderBy: { startedAt: "desc" },
        }),
      })),
    ),
    prisma.jobRun.findMany({
      where: { status: "FAILED" },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    jobs: latest.map(({ run: _run, ...rest }) => rest),
    recentFailures: failures,
  };
}
