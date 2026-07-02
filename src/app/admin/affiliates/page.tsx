import { prisma } from "@/lib/prisma";
import { getAffiliatePerformance } from "@/lib/analytics";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { setAffiliateStatus } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage() {
  const [affiliates, performance] = await Promise.all([
    prisma.affiliate.findMany({
      include: {
        user: { select: { email: true, role: true, createdAt: true } },
        _count: { select: { assignments: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { displayName: "asc" },
    }),
    getAffiliatePerformance(),
  ]);

  const perfMap = new Map(performance.map((p) => [p.affiliateId, p]));

  return (
    <>
      <PageHeader
        title="Affiliates"
        subtitle="Manage affiliate accounts — pause or ban to revoke access."
      />

      <Card padded={false}>
        {affiliates.length === 0 ? (
          <EmptyState
            title="No affiliates yet"
            hint="Affiliates self-register at /register."
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Affiliate</th>
                <th>Status</th>
                <th className="text-right">Campaigns</th>
                <th className="text-right">Threads</th>
                <th className="text-right">Views</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">CTR</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {affiliates.map((a) => {
                const perf = perfMap.get(a.id);
                return (
                  <tr key={a.id}>
                    <td>
                      <p className="font-medium text-zinc-200">{a.displayName}</p>
                      <p className="text-xs text-zinc-500">
                        {a.user.email} · joined {formatDate(a.user.createdAt)}
                      </p>
                    </td>
                    <td>
                      <Badge value={a.status} />
                    </td>
                    <td className="num text-right">{a._count.assignments}</td>
                    <td className="num text-right">{perf?.threads ?? 0}</td>
                    <td className="num text-right">{formatNumber(perf?.views ?? 0)}</td>
                    <td className="num text-right">{formatNumber(perf?.clicks ?? 0)}</td>
                    <td className="num text-right">{formatPercent(perf?.ctr ?? 0)}</td>
                    <td className="num text-right font-medium text-zinc-200">
                      {formatMoney(perf?.revenue ?? 0)}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {a.status !== "ACTIVE" && (
                          <form action={setAffiliateStatus.bind(null, a.id, "ACTIVE")}>
                            <button className="btn-ghost">Activate</button>
                          </form>
                        )}
                        {a.status === "ACTIVE" && (
                          <form action={setAffiliateStatus.bind(null, a.id, "PAUSED")}>
                            <button className="btn-ghost">Pause</button>
                          </form>
                        )}
                        {a.status !== "BANNED" && (
                          <form action={setAffiliateStatus.bind(null, a.id, "BANNED")}>
                            <button className="btn-ghost text-red-400 hover:text-red-300">
                              Ban
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
