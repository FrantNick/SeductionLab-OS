import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAffiliateRank, getLeaderboard } from "@/lib/leaderboard";
import { getSetting } from "@/lib/app-settings";
import { Card, PageHeader } from "@/components/ui";
import { LeaderboardTable } from "@/components/leaderboard-table";

export const dynamic = "force-dynamic";

export default async function AffiliateLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const session = await auth();
  const affiliateId = session?.user.affiliateId ?? null;
  const { campaign: campaignId } = await searchParams;

  const [campaigns, size, rank] = await Promise.all([
    // affiliates only pick between boards for campaigns they're on
    prisma.campaign.findMany({
      where: affiliateId
        ? { assignments: { some: { affiliateId, status: "ACTIVE" } } }
        : { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getSetting<number>("defaults.leaderboardSize"),
    affiliateId ? getAffiliateRank(affiliateId) : null,
  ]);
  const selected = campaigns.find((c) => c.id === campaignId) ?? null;
  const rows = await getLeaderboard(selected?.id ?? null, size);

  return (
    <>
      <PageHeader
        title="Leaderboard"
        subtitle={
          selected ? `Campaign scope: ${selected.name}` : "Global — every campaign combined."
        }
        action={
          rank && (
            <div className="card px-4 py-2 text-right">
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Your rank</p>
              <p className="text-lg font-semibold text-ember-text">
                #{rank.rank} <span className="text-xs text-zinc-500">of {rank.total}</span>
              </p>
            </div>
          )
        }
      />

      {campaigns.length > 0 && (
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
      )}

      <Card padded={false}>
        <LeaderboardTable rows={rows} highlightAffiliateId={affiliateId} />
      </Card>
    </>
  );
}
