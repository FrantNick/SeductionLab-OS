import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getThreadsWithLatestMetrics } from "@/lib/analytics";
import { apifyEnabled } from "@/lib/apify";
import { formatNumber, timeAgo } from "@/lib/format";
import { Card, EmptyState, ExternalLink, InternalLink, PageHeader } from "@/components/ui";
import { ThreadSubmitForm } from "@/components/thread-submit-form";
import { ScrapeButton } from "@/components/scrape-button";

export const dynamic = "force-dynamic";

export default async function ThreadsPage() {
  const session = await auth();
  const affiliateId = session?.user.affiliateId;
  if (!affiliateId) redirect("/dashboard");

  const [assignments, threads, scrapingEnabled] = await Promise.all([
    prisma.campaignAssignment.findMany({
      where: { affiliateId, status: "ACTIVE", campaign: { status: "ACTIVE" } },
      include: { campaign: { select: { id: true, name: true } } },
    }),
    getThreadsWithLatestMetrics({ affiliateId }),
    apifyEnabled(),
  ]);

  return (
    <>
      <PageHeader
        title="Threads"
        subtitle="Submit the URL of a posted thread; metrics refresh automatically every 6 hours."
      />

      <Card title="Submit a thread">
        <ThreadSubmitForm
          campaigns={assignments.map((a) => ({ id: a.campaign.id, name: a.campaign.name }))}
        />
      </Card>

      <Card title="My threads" className="mt-6" padded={false}>
        {threads.length === 0 ? (
          <EmptyState
            title="No threads submitted yet"
            hint="Post a thread on X, then paste its URL above."
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Thread</th>
                <th>Campaign</th>
                <th className="text-right">Views</th>
                <th className="text-right">Likes</th>
                <th className="text-right">Replies</th>
                <th className="text-right">Retweets</th>
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
                  <td className="num text-right">{formatNumber(t.views)}</td>
                  <td className="num text-right">{formatNumber(t.likes)}</td>
                  <td className="num text-right">{formatNumber(t.replies)}</td>
                  <td className="num text-right">{formatNumber(t.retweets)}</td>
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
