import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { PasswordForm } from "@/components/password-form";
import { updateNotificationPrefs, updateProfile } from "./actions";

export const dynamic = "force-dynamic";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Bucharest",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
];

export default async function AffiliateSettingsPage() {
  const session = await auth();
  if (!session?.user.affiliateId) redirect("/dashboard");

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: session.user.affiliateId },
  });
  if (!affiliate) redirect("/dashboard");

  const prefs = (affiliate.notificationPrefs as Record<string, boolean> | null) ?? {
    onAssignment: true,
    onConversion: true,
    onLeaderboard: false,
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Your profile, notifications and account security." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <form action={updateProfile} className="grid gap-4">
            <div>
              <label htmlFor="displayName" className="mb-1.5 block text-xs font-medium text-zinc-400">
                Display name
              </label>
              <input
                id="displayName"
                name="displayName"
                className="input"
                required
                minLength={2}
                maxLength={50}
                defaultValue={affiliate.displayName}
              />
              <p className="mt-1 text-xs text-zinc-500">Shown on leaderboards and to admins.</p>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-zinc-400">
                Affiliate handle
              </span>
              <p className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm">
                <code className="text-ember-text">{affiliate.handle ?? affiliate.id}</code>
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Identifies you on product landing pages — your tracking links append{" "}
                <code>?affiliate={affiliate.handle ?? affiliate.id}</code> automatically.
              </p>
            </div>
            <div>
              <label htmlFor="avatarUrl" className="mb-1.5 block text-xs font-medium text-zinc-400">
                Avatar URL
              </label>
              <input
                id="avatarUrl"
                name="avatarUrl"
                type="url"
                className="input"
                placeholder="https://…/avatar.png"
                defaultValue={affiliate.avatarUrl ?? ""}
              />
            </div>
            <div>
              <label htmlFor="timezone" className="mb-1.5 block text-xs font-medium text-zinc-400">
                Timezone
              </label>
              <select
                id="timezone"
                name="timezone"
                className="input"
                defaultValue={affiliate.timezone ?? "UTC"}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary w-fit">
              Save profile
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title="Notifications">
            <form action={updateNotificationPrefs} className="space-y-3">
              {(
                [
                  ["onAssignment", "Campaign assignments", "When an admin assigns you to a campaign"],
                  ["onConversion", "Sales", "When revenue is recorded for you"],
                  ["onLeaderboard", "Leaderboard changes", "When your rank moves"],
                ] as const
              ).map(([key, label, hint]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    name={key}
                    defaultChecked={prefs[key] ?? false}
                    className="mt-0.5 h-4 w-4 accent-[#C94B2C]"
                  />
                  <span>
                    <span className="block text-sm text-zinc-200">{label}</span>
                    <span className="block text-xs text-zinc-500">{hint}</span>
                  </span>
                </label>
              ))}
              <button type="submit" className="btn-secondary">
                Save preferences
              </button>
            </form>
          </Card>

          <Card title="Password">
            <PasswordForm />
          </Card>
        </div>
      </div>
    </>
  );
}
