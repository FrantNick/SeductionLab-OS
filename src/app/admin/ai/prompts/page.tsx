import { prisma } from "@/lib/prisma";
import { isFlagEnabled } from "@/lib/feature-flags";
import { PROMPT_CATEGORIES } from "@/lib/ai/registry";
import { timeAgo } from "@/lib/format";
import {
  Card,
  EmptyState,
  FeatureDisabledNotice,
  InternalLink,
  PageHeader,
} from "@/components/ui";
import { AiTabs } from "@/components/ai-tabs";
import { createPromptAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminPromptsPage() {
  if (!(await isFlagEnabled("ai"))) {
    return (
      <>
        <PageHeader title="Prompts" subtitle="Versioned prompt management." />
        <FeatureDisabledNotice feature="AI" />
      </>
    );
  }

  const prompts = await prisma.prompt.findMany({
    include: {
      activeVersion: { select: { version: true } },
      _count: { select: { versions: true, modelConfigs: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Prompts"
        subtitle="Every save creates a new version; the active pointer selects which one runs. Rollback never deletes."
      />
      <AiTabs />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Prompt library" className="lg:col-span-3" padded={false}>
          {prompts.length === 0 ? (
            <EmptyState
              title="No prompts yet"
              hint="Create one on the right, or run the seed to install the defaults."
            />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Prompt</th>
                  <th>Category</th>
                  <th className="text-right">Active</th>
                  <th className="text-right">Versions</th>
                  <th className="text-right">Used by</th>
                  <th className="text-right">Updated</th>
                </tr>
              </thead>
              <tbody>
                {prompts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <InternalLink href={`/admin/ai/prompts/${p.id}`}>{p.name}</InternalLink>
                      <p className="text-xs text-zinc-500">
                        <code>{p.slug}</code>
                      </p>
                    </td>
                    <td className="text-zinc-400">{p.category}</td>
                    <td className="num text-right">
                      {p.activeVersion ? `v${p.activeVersion.version}` : "—"}
                    </td>
                    <td className="num text-right">{p._count.versions}</td>
                    <td className="num text-right">
                      {p._count.modelConfigs > 0 ? `${p._count.modelConfigs} feature(s)` : "—"}
                    </td>
                    <td className="text-right text-xs text-zinc-500">{timeAgo(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="New prompt" className="lg:col-span-2">
          <form action={createPromptAction} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Name</label>
                <input name="name" className="input" required placeholder="Thread Writer" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Slug</label>
                <input
                  name="slug"
                  className="input"
                  required
                  pattern="[a-z0-9-]+"
                  placeholder="thread-writer"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Category</label>
              <select name="category" className="input" defaultValue="general">
                {PROMPT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Variables (comma-separated)
              </label>
              <input name="variables" className="input" placeholder="product, angle, audience" />
              <p className="mt-1 text-xs text-zinc-500">
                Referenced in content as <code>{"{{variable}}"}</code>.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Content</label>
              <textarea
                name="content"
                className="input min-h-40"
                required
                placeholder="You write X threads for {{product}}…"
              />
            </div>
            <button type="submit" className="btn-primary w-fit">
              Create prompt
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
