import { prisma } from "@/lib/prisma";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ConversionForm } from "@/components/conversion-form";

export const dynamic = "force-dynamic";

export default async function AdminConversionsPage() {
  const [affiliates, campaigns, conversions] = await Promise.all([
    prisma.affiliate.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
    prisma.campaign.findMany({
      where: { status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.conversion.findMany({
      include: {
        affiliate: { select: { displayName: true } },
        campaign: { select: { name: true } },
        product: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Conversions"
        subtitle="V1 uses manual revenue entry — webhook attribution arrives in V2."
      />

      <Card title="Record a sale">
        <ConversionForm affiliates={affiliates} campaigns={campaigns} />
      </Card>

      <Card title="Recent conversions" className="mt-6" padded={false}>
        {conversions.length === 0 ? (
          <EmptyState title="No conversions recorded yet" />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>When</th>
                <th>Affiliate</th>
                <th>Campaign</th>
                <th>Product</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((c) => (
                <tr key={c.id}>
                  <td className="text-xs text-zinc-500">{formatDateTime(c.createdAt)}</td>
                  <td className="font-medium text-zinc-200">{c.affiliate.displayName}</td>
                  <td className="text-zinc-400">{c.campaign.name}</td>
                  <td className="text-zinc-400">{c.product.name}</td>
                  <td className="num text-right font-medium text-zinc-200">
                    {formatMoney(Number(c.revenue))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
