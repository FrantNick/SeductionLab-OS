import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fullTrackingUrl } from "@/lib/tracking";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { GenerateLinkButton } from "@/components/generate-link-button";

export const dynamic = "force-dynamic";

export default async function AffiliateCampaignsPage() {
  const session = await auth();
  const affiliateId = session?.user.affiliateId;
  if (!affiliateId) redirect("/dashboard");

  const assignments = await prisma.campaignAssignment.findMany({
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
  });

  return (
    <>
      <PageHeader
        title="My campaigns"
        subtitle="Campaigns you are assigned to — angle, playbook and your tracking link."
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
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Your tracking link
                  </p>
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
