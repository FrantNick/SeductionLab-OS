import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);

  const where: Prisma.AuditLogWhereInput = q
    ? {
        OR: [
          { action: { contains: q, mode: "insensitive" } },
          { entityType: { contains: q, mode: "insensitive" } },
          { entityId: { contains: q, mode: "insensitive" } },
          { user: { email: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (p: number) =>
    `/admin/audit?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every privileged action — who, when, what. Append-only."
      />

      <form method="GET" className="mb-6 flex items-center gap-2">
        <input
          name="q"
          className="input w-80"
          placeholder="Filter by action, entity or admin email…"
          defaultValue={q}
          aria-label="Filter audit log"
        />
        <button type="submit" className="btn-secondary">
          Filter
        </button>
        {q && (
          <Link href="/admin/audit" className="btn-ghost">
            Clear
          </Link>
        )}
      </form>

      <Card padded={false}>
        {logs.length === 0 ? (
          <EmptyState
            title={q ? "No entries match the filter" : "No audited actions yet"}
            hint="Product, campaign, settings, AI and job actions are recorded here."
          />
        ) : (
          <>
            <table className="table-base">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Entity</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-xs text-zinc-500">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td>
                      <code className="text-xs text-ember-text">{log.action}</code>
                    </td>
                    <td className="text-xs text-zinc-400">{log.user?.email ?? "system"}</td>
                    <td className="text-xs text-zinc-400">
                      {log.entityType && (
                        <>
                          {log.entityType}
                          {log.entityId && (
                            <span className="text-zinc-600"> · {log.entityId.slice(0, 12)}</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="max-w-xs truncate text-xs text-zinc-500">
                      {log.metadata ? JSON.stringify(log.metadata) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-ink-800 px-5 py-2.5">
              <span className="text-[11px] text-zinc-500">
                {total} entries · page {page} of {pages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className="btn-ghost">
                    ← Newer
                  </Link>
                )}
                {page < pages && (
                  <Link href={pageHref(page + 1)} className="btn-ghost">
                    Older →
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
