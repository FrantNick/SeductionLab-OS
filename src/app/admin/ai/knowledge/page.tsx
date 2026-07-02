import { prisma } from "@/lib/prisma";
import { isFlagEnabled } from "@/lib/feature-flags";
import { formatNumber, timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, FeatureDisabledNotice, PageHeader } from "@/components/ui";
import { AiTabs } from "@/components/ai-tabs";
import { KnowledgeForm } from "@/components/knowledge-form";
import { ConfirmAction } from "@/components/confirm-dialog";
import { deleteKnowledgeDocument } from "../actions";

export const dynamic = "force-dynamic";

function formatBytes(n: number): string {
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export default async function AdminKnowledgePage() {
  if (!(await isFlagEnabled("ai"))) {
    return (
      <>
        <PageHeader title="Knowledge base" subtitle="Documents the AI can retrieve from." />
        <FeatureDisabledNotice feature="AI" />
      </>
    );
  }

  const documents = await prisma.knowledgeDocument.findMany({
    include: { _count: { select: { chunks: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Knowledge base"
        subtitle="SOPs, swipe files and reference docs — chunked on ingest, RAG-ready (embedding column reserved)."
      />
      <AiTabs />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title={`Documents (${documents.length})`} className="lg:col-span-3" padded={false}>
          {documents.length === 0 ? (
            <EmptyState
              title="Nothing ingested yet"
              hint="Upload a PDF or paste a playbook — the chat assistant retrieves from here."
            />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Kind</th>
                  <th className="text-right">Chunks</th>
                  <th className="text-right">Size</th>
                  <th className="text-right">Added</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <p className="font-medium text-zinc-200">{doc.title}</p>
                      {doc.tags.length > 0 && (
                        <p className="mt-0.5 text-xs text-zinc-500">{doc.tags.join(" · ")}</p>
                      )}
                      {doc.status !== "READY" && (
                        <span className="mt-1 inline-block">
                          <Badge value={doc.status === "FAILED" ? "error" : "PAUSED"} />
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-zinc-400">{doc.kind.toLowerCase()}</td>
                    <td className="num text-right">{formatNumber(doc._count.chunks)}</td>
                    <td className="num text-right text-xs">{formatBytes(doc.sizeBytes)}</td>
                    <td className="text-right text-xs text-zinc-500">{timeAgo(doc.createdAt)}</td>
                    <td className="text-right">
                      <ConfirmAction
                        action={deleteKnowledgeDocument.bind(null, doc.id)}
                        title={`Delete "${doc.title}"?`}
                        description="The document and all its chunks are removed from retrieval permanently."
                        confirmLabel="Delete"
                      >
                        <span className="btn-ghost text-red-400">Delete</span>
                      </ConfirmAction>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Ingest a document" className="lg:col-span-2">
          <KnowledgeForm />
        </Card>
      </div>
    </>
  );
}
