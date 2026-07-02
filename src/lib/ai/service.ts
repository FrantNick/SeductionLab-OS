import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { chat, type ChatMessage, type ChatResult } from "@/lib/ai/adapters";
import { buildPlatformContext, searchKnowledge } from "@/lib/ai/context";

/**
 * Feature-level AI entry point. Resolution chain (all database-driven,
 * nothing hardcoded):
 *
 *   feature → AiModelConfig → AiProvider (+ key) → adapter
 *                       ↘ system Prompt (active version)
 */

export class AiNotConfiguredError extends Error {}

export type ResolvedFeature = {
  providerKind: "OPENAI_COMPATIBLE" | "ANTHROPIC" | "GOOGLE";
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string | null;
};

export async function resolveFeature(feature: string): Promise<ResolvedFeature> {
  const config = await prisma.aiModelConfig.findUnique({
    where: { feature },
    include: { provider: true, systemPrompt: { include: { activeVersion: true } } },
  });

  if (!config || !config.enabled) {
    throw new AiNotConfiguredError(
      `AI feature "${feature}" is not enabled — configure it under Admin → AI.`,
    );
  }
  if (!config.provider || !config.provider.enabled) {
    throw new AiNotConfiguredError(
      `No enabled provider for "${feature}" — connect one under Admin → AI.`,
    );
  }
  if (!config.provider.apiKeyEncrypted) {
    throw new AiNotConfiguredError(
      `Provider "${config.provider.name}" has no API key — add one under Admin → AI.`,
    );
  }
  if (!config.model) {
    throw new AiNotConfiguredError(`No model selected for "${feature}".`);
  }

  return {
    providerKind: config.provider.kind,
    providerName: config.provider.name,
    baseUrl: config.provider.baseUrl,
    apiKey: decryptSecret(config.provider.apiKeyEncrypted),
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    systemPrompt: config.systemPrompt?.activeVersion?.content ?? null,
  };
}

/**
 * Runs a chat-assistant turn with live platform context and knowledge-
 * base retrieval. Throws AiNotConfiguredError when no real provider is
 * configured — the platform never fabricates AI output.
 */
export async function runAssistantTurn(
  history: ChatMessage[],
  userMessage: string,
): Promise<ChatResult & { model: string; provider: string }> {
  const resolved = await resolveFeature("chat-assistant");

  const [platformContext, knowledge] = await Promise.all([
    buildPlatformContext(),
    searchKnowledge(userMessage),
  ]);

  const systemParts = [
    resolved.systemPrompt ??
      "You are the Seduction Lab OS assistant. Help admins and affiliates understand campaigns, threads, metrics and leaderboards. Be concise and concrete.",
    platformContext,
  ];
  if (knowledge.length > 0) {
    systemParts.push("## Knowledge base excerpts\n" + knowledge.join("\n\n---\n\n"));
  }

  const result = await chat(resolved.providerKind, {
    baseUrl: resolved.baseUrl,
    apiKey: resolved.apiKey,
    model: resolved.model,
    temperature: resolved.temperature,
    maxTokens: resolved.maxTokens,
    messages: [
      { role: "system", content: systemParts.join("\n\n") },
      ...history.slice(-12),
      { role: "user", content: userMessage },
    ],
  });

  return { ...result, model: resolved.model, provider: resolved.providerName };
}
