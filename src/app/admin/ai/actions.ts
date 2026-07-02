"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { validateCredentials } from "@/lib/ai/adapters";
import { PROVIDER_PRESETS } from "@/lib/ai/registry";
import {
  activatePromptVersion,
  createPrompt,
  savePromptVersion,
} from "@/lib/ai/prompts";

// ── Providers ────────────────────────────────────────────────────────

const providerSchema = z.object({
  slug: z.string().min(2).max(40),
  baseUrl: z.string().url(),
  apiKey: z.string(),
});

/** Create-or-update a provider from a preset slug + optional key. */
export async function saveProvider(formData: FormData) {
  const session = await requireAdmin();
  const data = providerSchema.parse({
    slug: formData.get("slug"),
    baseUrl: formData.get("baseUrl"),
    apiKey: formData.get("apiKey") ?? "",
  });

  const preset = PROVIDER_PRESETS.find((p) => p.slug === data.slug);
  const name = preset?.name ?? data.slug;
  const kind = preset?.kind ?? "OPENAI_COMPATIBLE";

  const existing = await prisma.aiProvider.findUnique({ where: { slug: data.slug } });
  const apiKeyEncrypted = data.apiKey
    ? encryptSecret(data.apiKey)
    : (existing?.apiKeyEncrypted ?? null);

  await prisma.aiProvider.upsert({
    where: { slug: data.slug },
    create: {
      slug: data.slug,
      name,
      kind,
      baseUrl: data.baseUrl,
      apiKeyEncrypted,
      enabled: Boolean(apiKeyEncrypted),
      status: apiKeyEncrypted ? "ok" : "unconfigured",
    },
    update: {
      baseUrl: data.baseUrl,
      apiKeyEncrypted,
      ...(data.apiKey ? { enabled: true, status: "ok" } : {}),
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "ai.provider_configured",
    entityType: "ai-provider",
    entityId: data.slug,
  });
  revalidatePath("/admin/ai");
}

export async function toggleProvider(providerId: string, enabled: boolean) {
  await requireAdmin();
  await prisma.aiProvider.update({ where: { id: providerId }, data: { enabled } });
  revalidatePath("/admin/ai");
}

/** Live credential check against the provider's /models endpoint. */
export async function validateProvider(providerId: string) {
  await requireAdmin();
  const provider = await prisma.aiProvider.findUnique({ where: { id: providerId } });
  if (!provider?.apiKeyEncrypted) return;

  const { decryptSecret } = await import("@/lib/crypto");
  const result = await validateCredentials(
    provider.kind,
    provider.baseUrl,
    decryptSecret(provider.apiKeyEncrypted),
  );
  await prisma.aiProvider.update({
    where: { id: providerId },
    data: { status: result.ok ? "ok" : `error: ${result.detail}`, lastValidatedAt: new Date() },
  });
  revalidatePath("/admin/ai");
}

// ── Model configs ────────────────────────────────────────────────────

const modelConfigSchema = z.object({
  feature: z.string().min(1),
  providerId: z.string().optional(),
  model: z.string().max(120),
  temperature: z.coerce.number().min(0).max(2),
  maxTokens: z.coerce.number().int().min(1).max(200_000),
  reasoningLevel: z.enum(["none", "low", "medium", "high"]),
  systemPromptId: z.string().optional(),
  enabled: z.boolean(),
});

export async function saveModelConfig(formData: FormData) {
  const session = await requireAdmin();
  const data = modelConfigSchema.parse({
    feature: formData.get("feature"),
    providerId: (formData.get("providerId") as string) || undefined,
    model: formData.get("model") ?? "",
    temperature: formData.get("temperature") ?? 0.7,
    maxTokens: formData.get("maxTokens") ?? 2048,
    reasoningLevel: formData.get("reasoningLevel") ?? "none",
    systemPromptId: (formData.get("systemPromptId") as string) || undefined,
    enabled: formData.get("enabled") === "on",
  });

  await prisma.aiModelConfig.update({
    where: { feature: data.feature },
    data: {
      providerId: data.providerId ?? null,
      model: data.model,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      reasoningLevel: data.reasoningLevel,
      systemPromptId: data.systemPromptId ?? null,
      enabled: data.enabled,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "ai.model_configured",
    entityType: "ai-feature",
    entityId: data.feature,
    metadata: { model: data.model, enabled: data.enabled },
  });
  revalidatePath("/admin/ai");
}

// ── Prompts ──────────────────────────────────────────────────────────

const promptSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and dashes"),
  name: z.string().min(2).max(120),
  category: z.string().min(1),
  content: z.string().min(1),
  variables: z.string().default(""),
});

export async function createPromptAction(formData: FormData) {
  const session = await requireAdmin();
  const data = promptSchema.parse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    category: formData.get("category"),
    content: formData.get("content"),
    variables: formData.get("variables") ?? "",
  });

  await createPrompt({
    slug: data.slug,
    name: data.name,
    category: data.category,
    content: data.content,
    variables: data.variables.split(",").map((v) => v.trim()).filter(Boolean),
  });

  await logAudit({
    userId: session.user.id,
    action: "ai.prompt_created",
    entityType: "prompt",
    entityId: data.slug,
  });
  revalidatePath("/admin/ai/prompts");
}

export async function savePromptVersionAction(promptId: string, formData: FormData) {
  await requireAdmin();
  const content = z.string().min(1).parse(formData.get("content"));
  const notes = String(formData.get("notes") ?? "");
  await savePromptVersion(promptId, { content, notes });
  revalidatePath("/admin/ai/prompts");
  revalidatePath(`/admin/ai/prompts/${promptId}`);
}

export async function activateVersionAction(promptId: string, versionId: string) {
  const session = await requireAdmin();
  await activatePromptVersion(promptId, versionId);
  await logAudit({
    userId: session.user.id,
    action: "ai.prompt_activated",
    entityType: "prompt",
    entityId: promptId,
    metadata: { versionId },
  });
  revalidatePath("/admin/ai/prompts");
  revalidatePath(`/admin/ai/prompts/${promptId}`);
}
