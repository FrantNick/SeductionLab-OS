import { prisma } from "@/lib/prisma";
import { apifyEnabled } from "@/lib/apify";
import { getJobStatus } from "@/lib/job-runs";
import { fullTrackingUrl } from "@/lib/tracking";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { RunJobButton } from "@/components/run-job-button";
import { CopyButton } from "@/components/copy-button";
import { generateTestLink } from "./actions";

export const dynamic = "force-dynamic";

function EnvBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900 px-3 py-2">
      <span className="text-sm text-zinc-300">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
          ok
            ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
            : "bg-red-500/10 text-red-400 ring-red-500/30"
        }`}
      >
        {ok ? "configured" : "missing"}
      </span>
    </div>
  );
}

export default async function AdminDebugPage() {
  const dbStart = Date.now();
  const [
    counts,
    jobStatus,
    apify,
    providers,
    affiliates,
    campaigns,
    recentLinks,
  ] = await Promise.all([
    Promise.all([
      prisma.user.count(),
      prisma.affiliate.count(),
      prisma.campaign.count(),
      prisma.thread.count(),
      prisma.threadMetrics.count(),
      prisma.trackingLink.count(),
      prisma.click.count(),
      prisma.conversion.count(),
      prisma.leaderboardEntry.count(),
      prisma.notification.count(),
      prisma.auditLog.count(),
    ]),
    getJobStatus(),
    apifyEnabled(),
    prisma.aiProvider.findMany({ select: { name: true, enabled: true, status: true } }),
    prisma.affiliate.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.campaign.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.trackingLink.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        affiliate: { select: { displayName: true } },
        campaign: { select: { name: true } },
      },
    }),
  ]);
  const dbLatencyMs = Date.now() - dbStart;

  const [
    users, affiliateCount, campaignCount, threads, metrics, links, clicks,
    conversions, lbEntries, notifications, auditLogs,
  ] = counts;

  const dbStats = [
    { label: "Users", value: users },
    { label: "Affiliates", value: affiliateCount },
    { label: "Campaigns", value: campaignCount },
    { label: "Threads", value: threads },
    { label: "Metric snapshots", value: metrics },
    { label: "Tracking links", value: links },
    { label: "Clicks", value: clicks },
    { label: "Conversions", value: conversions },
    { label: "Leaderboard entries", value: lbEntries },
    { label: "Notifications", value: notifications },
    { label: "Audit logs", value: auditLogs },
  ];

  return (
    <>
      <PageHeader
        title="Debug"
        subtitle="Developer tools — visible to admins only, never to affiliates."
      />

      {/* Job triggers + cron status */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Scheduled jobs">
          <div className="flex flex-wrap gap-2">
            <RunJobButton job="leaderboard" label="Run leaderboard" />
            <RunJobButton job="refresh-metrics" label="Run metrics refresh" />
            <RunJobButton job="all" label="Run all jobs" variant="primary" />
          </div>
          <ul className="mt-4 space-y-2">
            {jobStatus.jobs.map((job) => (
              <li
                key={job.name}
                className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-200">{job.label}</p>
                  <p className="text-xs text-zinc-500">
                    {job.cadence} · <code>{job.schedule}</code>
                  </p>
                </div>
                <div className="text-right">
                  {job.lastRun ? (
                    <>
                      <p
                        className={`text-xs font-medium ${
                          job.lastRun.status === "SUCCESS"
                            ? "text-emerald-400"
                            : job.lastRun.status === "FAILED"
                              ? "text-red-400"
                              : "text-amber-400"
                        }`}
                      >
                        {job.lastRun.status.toLowerCase()} · {job.lastRun.trigger}
                      </p>
                      <p className="text-[11px] text-zinc-600">{timeAgo(job.lastRun.startedAt)}</p>
                    </>
                  ) : (
                    <p className="text-xs text-zinc-600">never ran</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Environment + health */}
        <Card title="Environment & health">
          <div className="grid gap-2">
            <EnvBadge ok={Boolean(process.env.DATABASE_URL)} label="DATABASE_URL" />
            <EnvBadge ok={Boolean(process.env.AUTH_SECRET)} label="AUTH_SECRET" />
            <EnvBadge ok={Boolean(process.env.CRON_SECRET)} label="CRON_SECRET" />
            <EnvBadge ok={Boolean(process.env.IP_HASH_SALT)} label="IP_HASH_SALT" />
            <EnvBadge
              ok={Boolean(process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET)}
              label="ENCRYPTION_KEY (falls back to AUTH_SECRET)"
            />
            <EnvBadge ok={apify} label="Apify (integration or APIFY_TOKEN)" />
            <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900 px-3 py-2">
              <span className="text-sm text-zinc-300">Database round-trip</span>
              <span className="num text-xs text-zinc-400">{dbLatencyMs}ms</span>
            </div>
            {providers.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-900 px-3 py-2"
              >
                <span className="text-sm text-zinc-300">AI · {p.name}</span>
                <span className="text-xs text-zinc-400">
                  {p.enabled ? p.status : "disabled"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* DB stats + recent errors */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Database statistics" padded={false}>
          <table className="table-base">
            <tbody>
              {dbStats.map((row) => (
                <tr key={row.label}>
                  <td className="text-zinc-400">{row.label}</td>
                  <td className="num text-right font-medium text-zinc-200">
                    {formatNumber(row.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Recent job errors" padded={false}>
          {jobStatus.recentFailures.length === 0 ? (
            <EmptyState title="No failures recorded" hint="Job errors land here with full detail." />
          ) : (
            <ul className="divide-y divide-ink-800">
              {jobStatus.recentFailures.map((run) => (
                <li key={run.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-red-400">{run.job}</code>
                    <span className="text-[11px] text-zinc-600">
                      {formatDateTime(run.startedAt)}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs text-zinc-500">{run.error}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Test tracking link generator */}
      <Card title="Generate tracking link (any affiliate × campaign)" className="mt-6">
        {affiliates.length === 0 || campaigns.length === 0 ? (
          <p className="text-sm text-zinc-500">Needs at least one affiliate and one campaign.</p>
        ) : (
          <form action={generateTestLink} className="grid gap-4 sm:grid-cols-3">
            <select name="affiliateId" className="input" aria-label="Affiliate">
              {affiliates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>
            <select name="campaignId" className="input" aria-label="Campaign">
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary">
              Generate link
            </button>
          </form>
        )}
        {recentLinks.length > 0 && (
          <ul className="mt-4 space-y-2">
            {recentLinks.map((link) => (
              <li
                key={link.id}
                className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2"
              >
                <code className="flex-1 truncate text-xs text-ember-text">
                  {fullTrackingUrl(link.slug)}
                </code>
                <span className="text-[11px] text-zinc-500">
                  {link.affiliate.displayName} · {link.campaign.name}
                </span>
                <CopyButton text={fullTrackingUrl(link.slug)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
