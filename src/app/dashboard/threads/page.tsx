import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getThreadsWithLatestMetrics } from "@/lib/analytics";
import { apifyEnabled } from "@/lib/apify";
import { fullTrackingUrl } from "@/lib/tracking";
import { formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { Card, EmptyState, ExternalLink, InternalLink, PageHeader } from "@/components/ui";
import { ThreadSubmitForm } from "@/components/thread-submit-form";
import { ScrapeButton } from "@/components/scrape-button";

export const dynamic = "force-dynamic";

export default async function ThreadsPage() {
  const session = await auth();
  const affiliateId = session?.user.affiliateId;
  if (!affiliateId) redirect("/dashboard");

  const [assignments, threads, unusedLinks, scrapingEnabled] = await Promise.all([
    prisma.campaignAssignment.findMany({
      where: { affiliateId, status: "ACTIVE", campaign: { status: "ACTIVE" } },
      include: { campaign: { select: { id: true, name: true } } },
    }),
    getThreadsWithLatestMetrics({ affiliateId }),
    prisma.trackingLink.findMany({
      where: { affiliateId, threadId: null },
      select: { id: true, slug: true, campaignId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    apifyEnabled(),
  ]);

  return (
    <>
      <PageHeader
        title="Threads"
        subtitle="Submit a posted thread with the tracking link it contains — clicks and sales then attribute to that exact thread."
      />

      <Card title="Submit a thread">
        <ThreadSubmitForm
          campaigns={assignments.map((a) => ({ id: a.campaign.id, name: a.campaign.name }))}
          unusedLinks={unusedLinks.map((l) => ({
            id: l.id,
            slug: l.slug,
            url: fullTrackingUrl(l.slug),
            campaignId: l.campaignId,
            createdAt: l.createdAt,
          }))}
        />
      </Card>

      <Card title="My threads" className="mt-6" padded={false}>
        {threads.length === 0 ? (
          <EmptyState
            title="No threads submitted yet"
            hint="Create a tracking link, post your thread with it, then submit the thread URL above."
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Thread</th>
                <th>Campaign</th>
                <th>Link</th>
                <th className="text-right">Views</th>
                <th className="text-right">Clicks</th>
                <th className="text-right">CTR</th>
                <th className="text-right">Likes</th>
                <th className="text-right">Last scraped</th>
                {scrapingEnabled && <th className="w-20" />}
              </tr>
            </thead>
            <tbody>
              {threads.map((t) => (
                <tr key={t.id}>
                  <td className="max-w-xs">
                    <InternalLink href={`/dashboard/threads/${t.id}`}>
                      {t.text ? `${t.text.slice(0, 48)}${t.text.length > 48 ? "…" : ""}` : `Tweet ${t.twitterId}`}
                    </InternalLink>
                    <p className="mt-0.5 text-xs text-zinc-600">
                      <ExternalLink href={t.twitterUrl}>open on X ↗</ExternalLink>
                    </p>
                  </td>
                  <td className="text-zinc-400">{t.campaignName}</td>
                  <td>
                    {t.linkSlug ? (
                      <code className="text-xs text-ember-text">{t.linkSlug}</code>
                    ) : (
                      <span className="text-xs text-zinc-600">not linked</span>
                    )}
                  </td>
                  <td className="num text-right">{formatNumber(t.views)}</td>
                  <td className="num text-right font-medium text-zinc-200">
                    {formatNumber(t.clicks)}
                  </td>
                  <td className="num text-right">{formatPercent(t.ctr)}</td>
                  <td className="num text-right">{formatNumber(t.likes)}</td>
                  <td className="text-right text-xs text-zinc-500">{timeAgo(t.scrapedAt)}</td>
                  {scrapingEnabled && (
                    <td className="text-right">
                      <ScrapeButton threadId={t.id} twitterUrl={t.twitterUrl} compact />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
