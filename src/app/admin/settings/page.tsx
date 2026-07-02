import Link from "next/link";
import { getAllSettings } from "@/lib/app-settings";
import { getAllFlags } from "@/lib/feature-flags";
import { getJobStatus } from "@/lib/job-runs";
import { apifyEnabled } from "@/lib/apify";
import { trackingBaseUrl } from "@/lib/tracking";
import { timeAgo } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { saveAppSettings, toggleFeatureFlag } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [settings, flags, jobStatus, apify] = await Promise.all([
    getAllSettings(),
    getAllFlags(),
    getJobStatus(),
    apifyEnabled(),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Platform configuration — changes apply immediately, no redeploy."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Branding + defaults */}
        <Card title="Branding & defaults">
          <form action={saveAppSettings} className="grid gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">App name</label>
              <input
                name="branding.appName"
                className="input"
                defaultValue={String(settings["branding.appName"])}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Tagline</label>
              <input
                name="branding.tagline"
                className="input"
                defaultValue={String(settings["branding.tagline"])}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Tracking domain
              </label>
              <input
                name="tracking.domain"
                className="input"
                placeholder={trackingBaseUrl()}
                defaultValue={String(settings["tracking.domain"])}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Empty = use TRACKING_DOMAIN / NEXT_PUBLIC_APP_URL from the environment.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Leaderboard size
                </label>
                <input
                  name="defaults.leaderboardSize"
                  type="number"
                  min={5}
                  max={500}
                  className="input num"
                  defaultValue={Number(settings["defaults.leaderboardSize"])}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Currency</label>
                <input
                  name="defaults.currency"
                  className="input"
                  defaultValue={String(settings["defaults.currency"])}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary w-fit">
              Save settings
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          {/* Feature flags */}
          <Card title="Feature flags" padded={false}>
            <ul className="divide-y divide-ink-800">
              {flags.map((flag) => (
                <li key={flag.key} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{flag.name}</p>
                    <p className="text-xs text-zinc-500">{flag.description}</p>
                  </div>
                  <form action={toggleFeatureFlag.bind(null, flag.key, !flag.enabled)}>
                    <button
                      type="submit"
                      role="switch"
                      aria-checked={flag.enabled}
                      aria-label={`Toggle ${flag.name}`}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        flag.enabled ? "bg-ember" : "bg-ink-600"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                          flag.enabled ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>

          {/* Service status */}
          <Card title="Service status" padded={false}>
            <ul className="divide-y divide-ink-800">
              <li className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-zinc-300">Apify scraping</span>
                <span className={`text-xs font-medium ${apify ? "text-emerald-400" : "text-amber-400"}`}>
                  {apify ? "configured" : "not configured"}
                </span>
              </li>
              {jobStatus.jobs.map((job) => (
                <li key={job.name} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-zinc-300">
                    {job.label} <span className="text-xs text-zinc-600">({job.cadence})</span>
                  </span>
                  <span className="text-xs text-zinc-500">
                    {job.lastRun
                      ? `${job.lastRun.status.toLowerCase()} · ${timeAgo(job.lastRun.startedAt)}`
                      : "never ran"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Future-ready sections */}
          <Card title="More configuration" padded={false}>
            <ul className="divide-y divide-ink-800">
              {[
                { href: "/admin/ai", label: "AI", hint: "Providers, models, prompts, knowledge base" },
                { href: "/admin/integrations", label: "Integrations", hint: "Apify, Stripe, Shopify, Gumroad…" },
                { href: "/admin/experiments", label: "Experiments", hint: "Time-bound campaign tests" },
                { href: "/admin/proxies", label: "Proxies", hint: "Outbound proxy routing & health" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-ink-800/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{item.label}</p>
                      <p className="text-xs text-zinc-500">{item.hint}</p>
                    </div>
                    <span className="text-zinc-600">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
