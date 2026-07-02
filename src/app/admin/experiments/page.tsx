import { prisma } from "@/lib/prisma";
import { isFlagEnabled } from "@/lib/feature-flags";
import { formatDate } from "@/lib/format";
import {
  Badge,
  Card,
  EmptyState,
  FeatureDisabledNotice,
  InternalLink,
  PageHeader,
} from "@/components/ui";
import { createExperiment } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminExperimentsPage() {
  if (!(await isFlagEnabled("experiments"))) {
    return (
      <>
        <PageHeader title="Experiments" subtitle="Time-bound campaign tests." />
        <FeatureDisabledNotice feature="Experiments" />
      </>
    );
  }

  const [experiments, campaigns] = await Promise.all([
    prisma.experiment.findMany({
      include: {
        campaign: { select: { name: true } },
        product: { select: { name: true } },
        winner: { select: { displayName: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.campaign.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED"] } },
      include: { product: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Experiments"
        subtitle="A test window + affiliate cohort over an existing campaign — clicks, threads and revenue flow through the normal pipelines."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title={`All experiments (${experiments.length})`} className="lg:col-span-3" padded={false}>
          {experiments.length === 0 ? (
            <EmptyState
              title="No experiments yet"
              hint="Create one on the right — pick a campaign, a goal and a time window."
            />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Experiment</th>
                  <th>Status</th>
                  <th>Window</th>
                  <th className="text-right">Cohort</th>
                  <th>Winner</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <InternalLink href={`/admin/experiments/${e.id}`}>{e.name}</InternalLink>
                      <p className="text-xs text-zinc-500">
                        {e.campaign.name} · {e.product.name}
                      </p>
                    </td>
                    <td>
                      <Badge value={e.status} />
                    </td>
                    <td className="text-xs text-zinc-400">
                      {formatDate(e.startDate)} → {formatDate(e.endDate)}
                    </td>
                    <td className="num text-right">{e._count.assignments}</td>
                    <td className="text-xs text-zinc-400">
                      {e.winner ? `🏆 ${e.winner.displayName}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="New experiment" className="lg:col-span-2">
          {campaigns.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Experiments run on top of a campaign — create an active campaign first.
            </p>
          ) : (
            <form action={createExperiment} className="grid gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Name</label>
                <input name="name" className="input" required placeholder="Hook A/B — week 27" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Campaign</label>
                <select name="campaignId" className="input" required>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.product.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500">The product follows the campaign.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Goal</label>
                <textarea
                  name="goal"
                  className="input min-h-20"
                  placeholder="What decides the winner? e.g. highest CTR over the window"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Start</label>
                  <input name="startDate" type="date" className="input" required defaultValue={today} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">End</label>
                  <input name="endDate" type="date" className="input" required />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Status</label>
                <select name="status" className="input" defaultValue="DRAFT">
                  <option value="DRAFT">Draft — set up first</option>
                  <option value="RUNNING">Running — starts immediately</option>
                </select>
              </div>
              <button type="submit" className="btn-primary w-fit">
                Create experiment
              </button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
