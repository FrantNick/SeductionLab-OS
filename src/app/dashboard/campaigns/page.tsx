import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fullTrackingUrl } from "@/lib/tracking";
import { getThreadsWithLatestMetrics } from "@/lib/analytics";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { GenerateLinkButton } from "@/components/generate-link-button";

export const dynamic = "force-dynamic";

export default async function AffiliateCampaignsPage() {
  const session = await auth();
  const affiliateId = session?.user.affiliateId;
  if (!affiliateId) redirect("/dashboard");

  const [assignments, clicksBy, convsBy, threads] = await Promise.all([
    prisma.campaignAssignment.findMany({
      where: { affiliateId, status: "ACTIVE" },
      include: {
        campaign: {
          include: {
            product: true,
            trackingLinks: { where: { affiliateId }, orderBy: { createdAt: "asc" }, take: 1 },
          },
        },
      },
      orderBy: { campaign: { name: "asc" } },
    }),
    prisma.click.groupBy({ by: ["campaignId"], where: { affiliateId }, _count: { _all: true } }),
    prisma.conversion.groupBy({
      by: ["campaignId"],
      where: { affiliateId },
      _sum: { revenue: true },
    }),
    getThreadsWithLatestMetrics({ affiliateId }),
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
            const existing = campaign.trackingLinks[0];
            const clicks = clickMap.get(campaign.id) ?? 0;
            const revenue = revMap.get(campaign.id) ?? 0;
            const tv = viewMap.get(campaign.id) ?? { views: 0, threads: 0 };
            const ctr = tv.views > 0 ? clicks / tv.views : 0;

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
                      Your tracking link
                    </p>
                    <div className="flex gap-3 text-xs">
                      <Link href="/dashboard/threads" className="text-ember-text hover:underline">
                        Submit thread
                      </Link>
                      <Link href="/dashboard/threads" className="text-zinc-400 hover:text-zinc-200">
                        View threads ({tv.threads})
                      </Link>
                    </div>
                  </div>
                  <GenerateLinkButton
                    campaignId={campaign.id}
                    existingUrl={existing ? fullTrackingUrl(existing.slug) : null}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
