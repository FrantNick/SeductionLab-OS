import { prisma } from "@/lib/prisma";
import { getLeaderboard } from "@/lib/leaderboard";
import { getSetting } from "@/lib/app-settings";
import { Card, PageHeader } from "@/components/ui";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { RunJobButton } from "@/components/run-job-button";

export const dynamic = "force-dynamic";

export default async function AdminLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign: campaignId } = await searchParams;

  const [campaigns, size] = await Promise.all([
    prisma.campaign.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getSetting<number>("defaults.leaderboardSize"),
  ]);
  const selected = campaigns.find((c) => c.id === campaignId) ?? null;
  const rows = await getLeaderboard(selected?.id ?? null, size);

  return (
    <>
      <PageHeader
        title="Leaderboard"
        subtitle={selected ? `Campaign scope: ${selected.name}` : "Global — every campaign combined."}
        action={<RunJobButton job="leaderboard" label="Recompute now" />}
      />

      <form method="GET" className="mb-6 flex items-center gap-2">
        <select
          name="campaign"
          className="input w-64"
          defaultValue={selected?.id ?? ""}
          aria-label="Leaderboard scope"
        >
          <option value="">Global (all campaigns)</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          View
        </button>
      </form>

      <Card padded={false}>
        <LeaderboardTable rows={rows} />
      </Card>
    </>
  );
}
