/**
 * Local development job scheduler.
 *
 * Production uses Vercel Cron (vercel.json) hitting /api/cron/*.
 * For local dev / self-hosting run:  npm run jobs:dev
 *
 *  - leaderboard refresh: every 10 minutes
 *  - Apify metrics refresh: every 6 hours
 */
import { runLeaderboardRefresh, runMetricsRefresh } from "../src/lib/jobs";

const TEN_MINUTES = 10 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;

async function leaderboardTick() {
  try {
    const result = await runLeaderboardRefresh();
    console.log(`[jobs] leaderboard refreshed:`, result);
  } catch (err) {
    console.error("[jobs] leaderboard job failed", err);
  }
}

async function metricsTick() {
  try {
    const result = await runMetricsRefresh();
    console.log(`[jobs] metrics refresh:`, result);
  } catch (err) {
    console.error("[jobs] metrics job failed", err);
  }
}

async function main() {
  console.log("Seduction Lab OS — job runner started");
  await leaderboardTick();
  await metricsTick();
  setInterval(leaderboardTick, TEN_MINUTES);
  setInterval(metricsTick, SIX_HOURS);
}

main();
