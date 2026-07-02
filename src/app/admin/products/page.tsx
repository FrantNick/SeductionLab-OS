import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { Card, EmptyState, ExternalLink, PageHeader } from "@/components/ui";
import { createProduct } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    include: { _count: { select: { campaigns: true, conversions: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="What campaigns sell — tracking links redirect to the product checkout."
      />

      <Card title="Add product">
        <form action={createProduct} className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Name</label>
            <input name="name" className="input" required minLength={2} placeholder="Confidence Reset (ebook)" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Price (USD)</label>
            <input name="price" type="number" min="0.01" step="0.01" className="input num" required placeholder="49.00" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              Add product
            </button>
          </div>
          <div className="sm:col-span-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Checkout URL</label>
            <input name="checkoutUrl" type="url" className="input" required placeholder="https://yourstore.gumroad.com/l/product" />
          </div>
        </form>
      </Card>

      <Card title="All products" className="mt-6" padded={false}>
        {products.length === 0 ? (
          <EmptyState title="No products yet" hint="Add one above to start creating campaigns." />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Product</th>
                <th>Checkout</th>
                <th className="text-right">Price</th>
                <th className="text-right">Campaigns</th>
                <th className="text-right">Conversions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-zinc-200">{p.name}</td>
                  <td className="max-w-xs truncate text-xs">
                    <ExternalLink href={p.checkoutUrl}>{p.checkoutUrl}</ExternalLink>
                  </td>
                  <td className="num text-right">{formatMoney(Number(p.price))}</td>
                  <td className="num text-right">{p._count.campaigns}</td>
                  <td className="num text-right">{p._count.conversions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
