import { prisma } from "@/lib/prisma";

/**
 * Versioned prompt management. Editing never mutates history: each save
 * creates a new PromptVersion; the prompt's activeVersionId pointer
 * selects which version runs. Rollback = activate an older version.
 */

export async function createPrompt(input: {
  slug: string;
  name: string;
  category: string;
  content: string;
  variables?: string[];
  notes?: string;
}) {
  const prompt = await prisma.prompt.create({
    data: { slug: input.slug, name: input.name, category: input.category },
  });
  const version = await prisma.promptVersion.create({
    data: {
      promptId: prompt.id,
      version: 1,
      content: input.content,
      variables: input.variables ?? [],
      notes: input.notes ?? "Initial version",
    },
  });
  return prisma.prompt.update({
    where: { id: prompt.id },
    data: { activeVersionId: version.id },
  });
}

/** Saves a new version and makes it active (history preserved). */
export async function savePromptVersion(
  promptId: string,
  input: { content: string; variables?: string[]; notes?: string },
) {
  const last = await prisma.promptVersion.findFirst({
    where: { promptId },
    orderBy: { version: "desc" },
  });
  const version = await prisma.promptVersion.create({
    data: {
      promptId,
      version: (last?.version ?? 0) + 1,
      content: input.content,
      variables: input.variables ?? last?.variables ?? [],
      notes: input.notes ?? "",
    },
  });
  await prisma.prompt.update({ where: { id: promptId }, data: { activeVersionId: version.id } });
  return version;
}

/** Rollback/forward: point the prompt at any existing version. */
export async function activatePromptVersion(promptId: string, versionId: string) {
  const version = await prisma.promptVersion.findUnique({ where: { id: versionId } });
  if (!version || version.promptId !== promptId) throw new Error("Version not found");
  await prisma.prompt.update({ where: { id: promptId }, data: { activeVersionId: versionId } });
}

export async function getActivePromptContent(slug: string): Promise<string | null> {
  const prompt = await prisma.prompt.findUnique({
    where: { slug },
    include: { activeVersion: true },
  });
  return prompt?.activeVersion?.content ?? null;
}

/**
 * Substitutes {{variable}} placeholders. Unknown placeholders are left
 * intact so a missing value is visible instead of silently dropped.
 */
export function renderPrompt(content: string, variables: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in variables ? variables[name] : match,
  );
}
