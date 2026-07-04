import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apifyEnabled } from "@/lib/apify";
import { getConversionsByLink } from "@/lib/analytics";
import { trackingBaseUrl } from "@/lib/tracking";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { Card, EmptyState, ExternalLink, PageHeader, StatCard } from "@/components/ui";
import { EngagementLineChart, ViewsLineChart } from "@/components/charts";
import { ScrapeButton } from "@/components/scrape-button";
import { CopyButton } from "@/components/copy-button";
import { LinkThreadForm } from "@/components/link-thread-form";

export const dynamic = "force-dynamic";

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const thread = await prisma.thread.findUnique({
    where: { id },
    include: {
      campaign: { select: { name: true } },
      affiliate: { select: { id: true, displayName: true } },
      metrics: { orderBy: { scrapedAt: "asc" } },
      trackingLink: { select: { id: true, slug: true, _count: { select: { clicks: true } } } },
    },
  });
  if (!thread) notFound();

  // Affiliates can only open their own threads; admins can open any.
  const isOwner = thread.affiliateId === session.user.affiliateId;
  if (session.user.role !== "ADMIN" && !isOwner) {
    notFound();
  }

  // Exact link performance + (for unlinked legacy threads) bind options.
  const [convByLink, bindOptions, linkBase] = await Promise.all([
    thread.trackingLink
      ? getConversionsByLink([thread.trackingLink.id])
      : Promise.resolve(new Map<string, { count: number; revenue: number }>()),
    !thread.trackingLink && isOwner
      ? prisma.trackingLink.findMany({
          where: { affiliateId: thread.affiliateId, campaignId: thread.campaignId, threadId: null },
          select: { id: true, slug: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    trackingBaseUrl(),
  ]);
  const linkConv = thread.trackingLink
    ? (convByLink.get(thread.trackingLink.id) ?? { count: 0, revenue: 0 })
    : { count: 0, revenue: 0 };
  const linkClicks = thread.trackingLink?._count.clicks ?? 0;

  const latest = thread.metrics[thread.metrics.length - 1];
  const series = thread.metrics.map((m) => ({
    label: formatDateTime(m.scrapedAt),
    views: m.views,
    likes: m.likes,
    replies: m.replies,
    retweets: m.retweets,
    quotes: m.quotes,
  }));

  return (
    <>
      <PageHeader
        title="Thread detail"
        subtitle={`${thread.campaign.name} · by ${thread.affiliate.displayName}`}
        action={(await apifyEnabled()) ? <ScrapeButton threadId={thread.id} twitterUrl={thread.twitterUrl} /> : undefined}
      />

      <Card>
        <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">
          {thread.text || "Thread text will appear after the first successful scrape."}
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          <ExternalLink href={thread.twitterUrl}>{thread.twitterUrl}</ExternalLink> · submitted{" "}
          {formatDateTime(thread.postedAt)}
        </p>
      </Card>

      {/* Exact link attribution: Click → TrackingLink → this thread */}
      {thread.trackingLink ? (
        <Card title="Tracking link performance" className="mt-6">
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2">
            <code className="flex-1 truncate text-xs text-ember-text">
              {`${linkBase}/go/${thread.trackingLink.slug}`}
            </code>
            <CopyButton text={`${linkBase}/go/${thread.trackingLink.slug}`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Clicks" value={formatNumber(linkClicks)} hint="on this thread's link" />
            <StatCard
              label="CTR"
              value={formatPercent((latest?.views ?? 0) > 0 ? linkClicks / latest!.views : 0)}
              hint="clicks ÷ views"
            />
            <StatCard
              label="Conversions"
              value={formatNumber(linkConv.count)}
              hint={`CVR ${formatPercent(linkClicks > 0 ? linkConv.count / linkClicks : 0)}`}
            />
            <StatCard label="Revenue" value={formatMoney(linkConv.revenue)} hint="from this link's clicks" />
          </div>
        </Card>
      ) : (
        <Card title="No tracking link bound" className="mt-6">
          <p className="mb-3 text-sm text-zinc-400">
            This thread predates per-thread links, so its clicks cannot be attributed exactly.
            {isOwner && " Bind one of your unused links from this campaign:"}
          </p>
          {isOwner && <LinkThreadForm threadId={thread.id} options={bindOptions.map((o) => ({
            id: o.id,
            slug: o.slug,
            url: `${linkBase}/go/${o.slug}`,
          }))} />}
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Views" value={formatNumber(latest?.views ?? 0)} />
        <StatCard label="Likes" value={formatNumber(latest?.likes ?? 0)} />
        <StatCard label="Replies" value={formatNumber(latest?.replies ?? 0)} />
        <StatCard label="Retweets" value={formatNumber(latest?.retweets ?? 0)} />
        <StatCard label="Quotes" value={formatNumber(latest?.quotes ?? 0)} />
      </div>

      {series.length >= 2 ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title="Views over time">
            <ViewsLineChart data={series} />
          </Card>
          <Card title="Engagement over time">
            <EngagementLineChart data={series} />
          </Card>
        </div>
      ) : (
        <Card className="mt-6">
          <EmptyState
            title="Not enough snapshots for a chart yet"
            hint="Each Apify scrape adds a snapshot; the refresh job runs every 6 hours."
          />
        </Card>
      )}

      <Card title="Scrape history" className="mt-6" padded={false}>
        {thread.metrics.length === 0 ? (
          <EmptyState title="No metrics yet" hint="Trigger a scrape or wait for the refresh job." />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Scraped at</th>
                <th className="text-right">Views</th>
                <th className="text-right">Likes</th>
                <th className="text-right">Replies</th>
                <th className="text-right">Retweets</th>
                <th className="text-right">Quotes</th>
              </tr>
            </thead>
            <tbody>
              {[...thread.metrics].reverse().map((m) => (
                <tr key={m.id}>
                  <td className="text-zinc-400">{formatDateTime(m.scrapedAt)}</td>
                  <td className="num text-right">{formatNumber(m.views)}</td>
                  <td className="num text-right">{formatNumber(m.likes)}</td>
                  <td className="num text-right">{formatNumber(m.replies)}</td>
                  <td className="num text-right">{formatNumber(m.retweets)}</td>
                  <td className="num text-right">{formatNumber(m.quotes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
