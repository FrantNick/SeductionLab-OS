import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getExperimentMetrics } from "@/lib/experiments";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ConfirmAction } from "@/components/confirm-dialog";
import {
  assignToExperiment,
  declareWinner,
  removeFromExperiment,
  setExperimentStatus,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const experiment = await prisma.experiment.findUnique({
    where: { id },
    include: {
      campaign: { select: { id: true, name: true } },
      product: { select: { name: true } },
      winner: { select: { id: true, displayName: true } },
      assignments: { include: { affiliate: { select: { displayName: true } } } },
    },
  });
  if (!experiment) notFound();

  const assignedIds = new Set(experiment.assignments.map((a) => a.affiliateId));
  const [metrics, candidates] = await Promise.all([
    getExperimentMetrics(id),
    // affiliates already on the campaign are the natural cohort candidates
    prisma.affiliate.findMany({
      where: {
        status: "ACTIVE",
        assignments: { some: { campaignId: experiment.campaignId, status: "ACTIVE" } },
      },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);
  const addable = candidates.filter((c) => !assignedIds.has(c.id));

  const transitions: { to: "RUNNING" | "COMPLETED" | "CANCELLED"; label: string }[] =
    experiment.status === "DRAFT"
      ? [
          { to: "RUNNING", label: "Start" },
          { to: "CANCELLED", label: "Cancel" },
        ]
      : experiment.status === "RUNNING"
        ? [
            { to: "COMPLETED", label: "Complete" },
            { to: "CANCELLED", label: "Cancel" },
          ]
        : [];

  return (
    <>
      <PageHeader
        title={experiment.name}
        subtitle={`${experiment.campaign.name} · ${experiment.product.name} · ${formatDate(
          experiment.startDate,
        )} → ${formatDate(experiment.endDate)}`}
        action={
          <div className="flex items-center gap-2">
            <Badge value={experiment.status} />
            {transitions.map((t) => (
              <form key={t.to} action={setExperimentStatus.bind(null, experiment.id, t.to)}>
                <button type="submit" className="btn-secondary">
                  {t.label}
                </button>
              </form>
            ))}
            <Link href="/admin/experiments" className="btn-ghost">
              ← All experiments
            </Link>
          </div>
        }
      />

      {experiment.goal && (
        <p className="mb-6 rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-zinc-400">
          <span className="font-medium text-zinc-300">Goal:</span> {experiment.goal}
        </p>
      )}

      {/* Window metrics (from the untouched click/conversion/thread pipelines) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Views" value={formatNumber(metrics?.views ?? 0)} hint="threads posted in window" />
        <StatCard label="Clicks" value={formatNumber(metrics?.clicks ?? 0)} hint={`CTR ${formatPercent(metrics?.ctr ?? 0)}`} />
        <StatCard label="Conversions" value={formatNumber(metrics?.conversions ?? 0)} />
        <StatCard label="Revenue" value={formatMoney(metrics?.revenue ?? 0)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Cohort standings */}
        <Card title="Cohort standings" className="lg:col-span-3" padded={false}>
          {!metrics || metrics.perAffiliate.length === 0 ? (
            <EmptyState title="No cohort yet" hint="Assign affiliates on the right." />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Affiliate</th>
                  <th className="text-right">Threads</th>
                  <th className="text-right">Clicks</th>
                  <th className="text-right">Revenue</th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody>
                {metrics.perAffiliate.map((row, i) => {
                  const isWinner = experiment.winnerAffiliateId === row.affiliateId;
                  const assignment = experiment.assignments.find(
                    (a) => a.affiliateId === row.affiliateId,
                  );
                  return (
                    <tr key={row.affiliateId}>
                      <td>
                        <span className="font-medium text-zinc-200">
                          {i === 0 && metrics.leaderId === row.affiliateId && "▲ "}
                          {row.displayName}
                        </span>
                        {isWinner && <span className="ml-2">🏆</span>}
                      </td>
                      <td className="num text-right">{row.threads}</td>
                      <td className="num text-right">{formatNumber(row.clicks)}</td>
                      <td className="num text-right font-medium text-zinc-200">
                        {formatMoney(row.revenue)}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          {experiment.status === "RUNNING" && !isWinner && (
                            <ConfirmAction
                              action={declareWinner.bind(null, experiment.id, row.affiliateId)}
                              title={`Declare ${row.displayName} the winner?`}
                              description="This completes the experiment and notifies the affiliate."
                              confirmLabel="Declare winner"
                              destructive={false}
                            >
                              <span className="btn-ghost">Winner</span>
                            </ConfirmAction>
                          )}
                          {assignment && experiment.status !== "COMPLETED" && (
                            <ConfirmAction
                              action={removeFromExperiment.bind(null, assignment.id)}
                              title={`Remove ${row.displayName} from the cohort?`}
                              description="Their campaign activity is untouched — they just leave this experiment."
                              confirmLabel="Remove"
                            >
                              <span className="btn-ghost text-red-400">Remove</span>
                            </ConfirmAction>
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

        {/* Assign affiliates */}
        <Card title="Assign affiliate" className="lg:col-span-2">
          {addable.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {candidates.length === 0
                ? "No active affiliates are assigned to this campaign yet — assign them on the campaign page first."
                : "Every campaign affiliate is already in the cohort."}
            </p>
          ) : (
            <form action={assignToExperiment.bind(null, experiment.id)} className="grid gap-4">
              <select name="affiliateId" className="input" aria-label="Affiliate">
                {addable.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary w-fit">
                Add to cohort
              </button>
            </form>
          )}
          <p className="mt-4 text-xs text-zinc-500">
            Cohort members are notified and see the experiment on their dashboard while it runs.
          </p>
        </Card>
      </div>
    </>
  );
}
