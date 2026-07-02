import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";
import { AiTabs } from "@/components/ai-tabs";
import { activateVersionAction, savePromptVersionAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function AdminPromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const prompt = await prisma.prompt.findUnique({
    where: { id },
    include: {
      activeVersion: true,
      versions: { orderBy: { version: "desc" } },
      modelConfigs: { select: { feature: true, name: true } },
    },
  });
  if (!prompt) notFound();

  const variables = (prompt.activeVersion?.variables as string[] | null) ?? [];

  return (
    <>
      <PageHeader
        title={prompt.name}
        subtitle={`${prompt.slug} · ${prompt.category}${
          prompt.modelConfigs.length > 0
            ? ` · powers ${prompt.modelConfigs.map((c) => c.name).join(", ")}`
            : ""
        }`}
        action={
          <Link href="/admin/ai/prompts" className="btn-secondary">
            ← All prompts
          </Link>
        }
      />
      <AiTabs />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Edit = save a new version */}
        <Card
          title={`Edit (saves v${(prompt.versions[0]?.version ?? 0) + 1})`}
          className="lg:col-span-3"
        >
          <form action={savePromptVersionAction.bind(null, prompt.id)} className="grid gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Content</label>
              <textarea
                name="content"
                className="input min-h-72 font-mono text-xs leading-relaxed"
                required
                defaultValue={prompt.activeVersion?.content ?? ""}
              />
              {variables.length > 0 && (
                <p className="mt-1 text-xs text-zinc-500">
                  Variables: {variables.map((v) => `{{${v}}}`).join(", ")}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Version notes
              </label>
              <input name="notes" className="input" placeholder="What changed and why" />
            </div>
            <button type="submit" className="btn-primary w-fit">
              Save as new version
            </button>
          </form>
        </Card>

        {/* Version history + rollback */}
        <Card title="Version history" className="lg:col-span-2" padded={false}>
          <ul className="divide-y divide-ink-800">
            {prompt.versions.map((version) => {
              const isActive = version.id === prompt.activeVersionId;
              return (
                <li key={version.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        v{version.version}
                        {isActive && (
                          <span className="ml-2 align-middle">
                            <Badge value="ACTIVE" />
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatDateTime(version.createdAt)}
                        {version.notes && ` · ${version.notes}`}
                      </p>
                    </div>
                    {!isActive && (
                      <form action={activateVersionAction.bind(null, prompt.id, version.id)}>
                        <button type="submit" className="btn-ghost">
                          Activate
                        </button>
                      </form>
                    )}
                  </div>
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                      Show content
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-900 p-3 text-xs text-zinc-400">
                      {version.content}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
