import { prisma } from "@/lib/prisma";
import { getGlobalStats } from "@/lib/analytics";
import { getLeaderboard } from "@/lib/leaderboard";

/**
 * Builds the live platform-context block injected into AI conversations,
 * so the assistant reasons over real data: products, campaigns, metrics,
 * leaderboards and (keyword-matched) knowledge-base excerpts.
 */
export async function buildPlatformContext(): Promise<string> {
  const [stats, campaigns, products, leaderboard, experiments] = await Promise.all([
    getGlobalStats(),
    prisma.campaign.findMany({
      where: { status: "ACTIVE" },
      include: { product: { select: { name: true } } },
      take: 20,
    }),
    prisma.product.findMany({ where: { archivedAt: null }, take: 20 }),
    getLeaderboard(null, 5),
    prisma.experiment.findMany({
      where: { status: "RUNNING" },
      include: { campaign: { select: { name: true } } },
      take: 10,
    }),
  ]);

  const lines = [
    "## Platform snapshot",
    `Totals: ${stats.affiliates} active affiliates · ${stats.threads} threads · ${stats.views} views · ${stats.clicks} clicks · $${stats.revenue.toFixed(0)} revenue · CTR ${(stats.ctr * 100).toFixed(2)}%`,
    "",
    "### Products",
    ...products.map((p) => `- ${p.name} ($${Number(p.price)})`),
    "",
    "### Active campaigns",
    ...campaigns.map((c) => `- ${c.name} — product: ${c.product.name} — angle: ${c.angle}`),
    "",
    "### Leaderboard (top 5)",
    ...leaderboard.map(
      (r) => `${r.rank}. ${r.displayName} — $${r.revenue.toFixed(0)} revenue, ${r.clicks} clicks`,
    ),
  ];

  if (experiments.length > 0) {
    lines.push(
      "",
      "### Running experiments",
      ...experiments.map((e) => `- ${e.name} (campaign: ${e.campaign.name}, goal: ${e.goal})`),
    );
  }

  return lines.join("\n");
}

/**
 * Keyword retrieval over knowledge chunks — the pre-embedding stage of
 * the RAG pipeline (vector search replaces the ranking in a later phase,
 * behind the same function signature).
 */
export async function searchKnowledge(query: string, limit = 3): Promise<string[]> {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3)
    .slice(0, 8);
  if (terms.length === 0) return [];

  const chunks = await prisma.knowledgeChunk.findMany({
    where: { OR: terms.map((t) => ({ content: { contains: t, mode: "insensitive" as const } })) },
    include: { document: { select: { title: true } } },
    take: 50,
  });

  const scored = chunks
    .map((c) => ({
      chunk: c,
      score: terms.filter((t) => c.content.toLowerCase().includes(t)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(
    ({ chunk }) => `From "${chunk.document.title}":\n${chunk.content.slice(0, 800)}`,
  );
}
