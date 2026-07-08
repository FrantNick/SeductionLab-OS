import Link from "next/link";
import { getAllSettings } from "@/lib/app-settings";
import { getAllFlags } from "@/lib/feature-flags";
import { getJobStatus } from "@/lib/job-runs";
import { apifyEnabled } from "@/lib/apify";
import { trackingBaseUrl } from "@/lib/tracking";
import { timeAgo } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui";
import { ToggleSwitch } from "@/components/toggle-switch";
import { saveAppSettings, toggleFeatureFlag } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [settings, flags, jobStatus, apify, linkBase] = await Promise.all([
    getAllSettings(),
    getAllFlags(),
    getJobStatus(),
    apifyEnabled(),
    trackingBaseUrl(),
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
                placeholder={linkBase}
                defaultValue={String(settings["tracking.domain"])}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Public origin for /go links (e.g. your ngrok domain). Applies to link display
                everywhere without a rebuild. Empty = use TRACKING_DOMAIN /
                NEXT_PUBLIC_APP_URL from the environment.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
          {/* Affiliate tracking — landing-URL parameter names */}
          <Card title="Affiliate tracking">
            <p className="mb-4 text-xs text-zinc-500">
              Tracking links redirect to the product landing page with these query parameters
              appended. Changes apply to every link immediately — the landing page (or a
              storefront like Shopify) reads them to attribute the visitor.
            </p>
            <form action={saveAppSettings} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Affiliate parameter name
                </label>
                <input
                  name="tracking.affiliateParam"
                  className="input"
                  required
                  pattern="[A-Za-z0-9_\-]+"
                  defaultValue={String(settings["tracking.affiliateParam"])}
                />
                <p className="mt-1 text-xs text-zinc-500">
                  e.g. <code>?affiliate=maya-writes</code>
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Tracking parameter name
                </label>
                <input
                  name="tracking.trackingParam"
                  className="input"
                  pattern="[A-Za-z0-9_\-]*"
                  defaultValue={String(settings["tracking.trackingParam"])}
                />
                <p className="mt-1 text-xs text-zinc-500">
                  e.g. <code>?ref=a8dj21</code> — the link slug, resolves to campaign + thread.
                  Leave empty to append only the affiliate parameter.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Bot filter window (minutes)
                </label>
                <input
                  name="tracking.botFilterMinutes"
                  type="number"
                  min={0}
                  max={1440}
                  className="input num w-40"
                  defaultValue={Number(settings["tracking.botFilterMinutes"])}
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Clicks arriving within this window after a thread is submitted are not logged
                  (X&apos;s preview bots hit fresh links immediately). Visitors are still
                  redirected. Set 0 to disable.
                </p>
              </div>
              <button type="submit" className="btn-primary w-fit sm:col-span-2">
                Save tracking parameters
              </button>
            </form>
          </Card>
          {/* Feature flags */}
          <Card title="Feature flags" padded={false}>
            <ul className="divide-y divide-ink-800">
              {flags.map((flag) => (
                <li key={flag.key} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{flag.name}</p>
                    <p className="text-xs text-zinc-500">{flag.description}</p>
                  </div>
                  <ToggleSwitch
                    action={toggleFeatureFlag.bind(null, flag.key, !flag.enabled)}
                    checked={flag.enabled}
                    label={`Toggle ${flag.name}`}
                  />
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
