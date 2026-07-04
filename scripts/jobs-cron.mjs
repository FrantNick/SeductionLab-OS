/**
 * Self-host job scheduler — hits the app's cron endpoints on LOCALHOST so
 * that executeJob() records JobRun rows (health checks, the debug panel
 * and Settings → Service status all read those). This is the production
 * counterpart of scripts/jobs-dev.ts, which calls job functions directly
 * and therefore records nothing.
 *
 *   node scripts/jobs-cron.mjs        (or via PM2: ecosystem.config.js)
 *
 * Deliberately targets localhost, never the public ngrok domain: internal
 * traffic must not depend on (or count against) the tunnel.
 *
 * Env: CRON_SECRET (required, read from environment or ./.env),
 *      CRON_TARGET (optional, default http://localhost:3000).
 */
import { readFileSync } from "node:fs";

// Minimal .env loader (no dependencies) — never overrides real env vars.
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
  }
} catch {
  // no .env file — rely on the process environment
}

const BASE = (process.env.CRON_TARGET ?? "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;
if (!SECRET) {
  console.error("[jobs-cron] CRON_SECRET is not set — refusing to start");
  process.exit(1);
}

const JOBS = [
  { name: "leaderboard", path: "/api/cron/leaderboard", everyMs: 10 * 60 * 1000 },
  { name: "refresh-metrics", path: "/api/cron/refresh-metrics", everyMs: 6 * 60 * 60 * 1000 },
];

async function run(job) {
  const startedAt = new Date().toISOString();
  try {
    const res = await fetch(`${BASE}${job.path}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
      // metrics refresh scrapes threads sequentially — allow a long run
      signal: AbortSignal.timeout(15 * 60 * 1000),
    });
    const body = await res.text().catch(() => "");
    console.log(
      `[jobs-cron] ${startedAt} ${job.name} → HTTP ${res.status} ${body.slice(0, 200)}`,
    );
  } catch (err) {
    console.error(`[jobs-cron] ${startedAt} ${job.name} FAILED: ${err?.message ?? err}`);
  }
}

console.log(`[jobs-cron] scheduler started → ${BASE} (leaderboard 10m, refresh-metrics 6h)`);
for (const job of JOBS) {
  run(job); // immediate first run, then on the interval
  setInterval(() => run(job), job.everyMs);
}
