import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getThreadsWithLatestMetrics } from "@/lib/analytics";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { GenerateLinkButton } from "@/components/generate-link-button";

export const dynamic = "force-dynamic";

export default async function AffiliateCampaignsPage() {
  const session = await auth();
  const affiliateId = session?.user.affiliateId;
  if (!affiliateId) redirect("/dashboard");

  const [assignments, clicksBy, convsBy, threads, myLinks] = await Promise.all([
    prisma.campaignAssignment.findMany({
      where: { affiliateId, status: "ACTIVE" },
      include: { campaign: { include: { product: true } } },
      orderBy: { campaign: { name: "asc" } },
    }),
    prisma.click.groupBy({ by: ["campaignId"], where: { affiliateId }, _count: { _all: true } }),
    prisma.conversion.groupBy({
      by: ["campaignId"],
      where: { affiliateId },
      _sum: { revenue: true },
    }),
    getThreadsWithLatestMetrics({ affiliateId }),
    prisma.trackingLink.findMany({
      where: { affiliateId },
      select: { campaignId: true, threadId: true },
    }),
  ]);

  const clickMap = new Map(clicksBy.map((c) => [c.campaignId, c._count._all]));
  const revMap = new Map(convsBy.map((c) => [c.campaignId, Number(c._sum.revenue ?? 0)]));
  const viewMap = new Map<string, { views: number; threads: number }>();
  for (const t of threads) {
    const cur = viewMap.get(t.campaignId) ?? { views: 0, threads: 0 };
    cur.views += t.views;
    cur.threads += 1;
    viewMap.set(t.campaignId, cur);
  }
  const linkMap = new Map<string, { total: number; linked: number }>();
  for (const l of myLinks) {
    const cur = linkMap.get(l.campaignId) ?? { total: 0, linked: 0 };
    cur.total += 1;
    if (l.threadId) cur.linked += 1;
    linkMap.set(l.campaignId, cur);
  }

  return (
    <>
      <PageHeader
        title="My campaigns"
        subtitle="Campaigns you are assigned to — angle, playbook, your performance and tracking link."
      />

      {assignments.length === 0 ? (
        <Card>
          <EmptyState
            title="No campaign assignments yet"
            hint="An admin needs to assign you to a campaign before you can generate links."
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {assignments.map(({ campaign }) => {
            const clicks = clickMap.get(campaign.id) ?? 0;
            const revenue = revMap.get(campaign.id) ?? 0;
            const tv = viewMap.get(campaign.id) ?? { views: 0, threads: 0 };
            const ctr = tv.views > 0 ? clicks / tv.views : 0;
            const linkStats = linkMap.get(campaign.id) ?? { total: 0, linked: 0 };
            const unusedLinks = linkStats.total - linkStats.linked;

            return (
              <Card key={campaign.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">{campaign.name}</h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {campaign.product.name} · {formatMoney(Number(campaign.product.price))} ·{" "}
                      {formatDate(campaign.startDate)} → {formatDate(campaign.endDate)}
                    </p>
                  </div>
                  <Badge value={campaign.status} />
                </div>

                {/* Your numbers in this campaign */}
                <div className="mt-4 grid grid-cols-4 gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5 text-center">
                  <div>
                    <p className="num text-sm font-semibold text-white">{formatNumber(tv.views)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Views</p>
                  </div>
                  <div>
                    <p className="num text-sm font-semibold text-white">{formatNumber(clicks)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Clicks</p>
                  </div>
                  <div>
                    <p className="num text-sm font-semibold text-white">{formatPercent(ctr)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">CTR</p>
                  </div>
                  <div>
                    <p className="num text-sm font-semibold text-white">{formatMoney(revenue)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Revenue</p>
                  </div>
                </div>

                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Angle
                    </dt>
                    <dd className="mt-1 text-zinc-300">{campaign.angle}</dd>
                  </div>
                  {campaign.instructions && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                        Instructions
                      </dt>
                      <dd className="mt-1 whitespace-pre-line text-zinc-400">
                        {campaign.instructions}
                      </dd>
                    </div>
                  )}
                  {campaign.exampleHook && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                        Example hook
                      </dt>
                      <dd className="mt-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-zinc-300">
                        “{campaign.exampleHook}”
                      </dd>
                    </div>
                  )}
                  {campaign.exampleCTA && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                        Example CTA
                      </dt>
                      <dd className="mt-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-zinc-300">
                        “{campaign.exampleCTA}”
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-5 border-t border-ink-800 pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Your tracking links
                    </p>
                    <div className="flex gap-3 text-xs">
                      <Link href="/dashboard/links" className="text-zinc-400 hover:text-zinc-200">
                        All links
                      </Link>
                      <Link href="/dashboard/threads" className="text-ember-text hover:underline">
                        Submit thread
                      </Link>
                      <Link href="/dashboard/threads" className="text-zinc-400 hover:text-zinc-200">
                        View threads ({tv.threads})
                      </Link>
                    </div>
                  </div>
                  <p className="mb-2 text-xs text-zinc-500">
                    {linkStats.total} link{linkStats.total === 1 ? "" : "s"} ·{" "}
                    {linkStats.linked} linked to threads ·{" "}
                    <span className={unusedLinks > 0 ? "text-emerald-400" : ""}>
                      {unusedLinks} unused
                    </span>{" "}
                    — create one per thread you plan to post.
                  </p>
                  <GenerateLinkButton campaignId={campaign.id} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
