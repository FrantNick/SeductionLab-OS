import type { AiProviderKind } from "@prisma/client";

/**
 * Provider presets and AI feature definitions. Presets only prefill the
 * configuration form — every value (base URL, model, prompt, params) is
 * stored in and resolved from the database at runtime. Nothing here is
 * a hardcoded runtime dependency.
 */

export type ProviderPreset = {
  slug: string;
  name: string;
  kind: AiProviderKind;
  baseUrl: string;
  docsUrl: string;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { slug: "openai", name: "OpenAI", kind: "OPENAI_COMPATIBLE", baseUrl: "https://api.openai.com/v1", docsUrl: "https://platform.openai.com/docs" },
  { slug: "anthropic", name: "Anthropic", kind: "ANTHROPIC", baseUrl: "https://api.anthropic.com/v1", docsUrl: "https://docs.claude.com" },
  { slug: "openrouter", name: "OpenRouter", kind: "OPENAI_COMPATIBLE", baseUrl: "https://openrouter.ai/api/v1", docsUrl: "https://openrouter.ai/docs" },
  { slug: "google", name: "Google AI", kind: "OPENAI_COMPATIBLE", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", docsUrl: "https://ai.google.dev" },
  { slug: "deepseek", name: "DeepSeek", kind: "OPENAI_COMPATIBLE", baseUrl: "https://api.deepseek.com/v1", docsUrl: "https://platform.deepseek.com" },
  { slug: "groq", name: "Groq", kind: "OPENAI_COMPATIBLE", baseUrl: "https://api.groq.com/openai/v1", docsUrl: "https://console.groq.com/docs" },
  { slug: "together", name: "Together AI", kind: "OPENAI_COMPATIBLE", baseUrl: "https://api.together.xyz/v1", docsUrl: "https://docs.together.ai" },
  { slug: "fireworks", name: "Fireworks", kind: "OPENAI_COMPATIBLE", baseUrl: "https://api.fireworks.ai/inference/v1", docsUrl: "https://docs.fireworks.ai" },
  { slug: "ollama", name: "Ollama (local)", kind: "OPENAI_COMPATIBLE", baseUrl: "http://localhost:11434/v1", docsUrl: "https://ollama.com" },
  { slug: "lmstudio", name: "LM Studio (local)", kind: "OPENAI_COMPATIBLE", baseUrl: "http://localhost:1234/v1", docsUrl: "https://lmstudio.ai/docs" },
];

export type AiFeatureDef = {
  feature: string;
  name: string;
  description: string;
  defaultPromptSlug: string;
};

/** Every AI-powered capability resolves its provider/model/prompt from AiModelConfig. */
export const AI_FEATURES: AiFeatureDef[] = [
  { feature: "chat-assistant", name: "AI Chat", description: "Conversational assistant with platform context", defaultPromptSlug: "chat-assistant" },
  { feature: "thread-writer", name: "Thread Writer", description: "Drafts full X threads from a campaign brief", defaultPromptSlug: "thread-writer" },
  { feature: "thread-analyzer", name: "Thread Analyzer", description: "Grades submitted threads and explains performance", defaultPromptSlug: "thread-analyzer" },
  { feature: "reply-generator", name: "Reply Generator", description: "Suggests replies that keep threads alive", defaultPromptSlug: "reply-generator" },
  { feature: "hook-generator", name: "Hook Generator", description: "Generates opening-tweet hook variants", defaultPromptSlug: "hook-generator" },
  { feature: "experiment-planner", name: "Experiment Planner", description: "Proposes time-bound experiments from campaign data", defaultPromptSlug: "experiment-planner" },
  { feature: "marketing-coach", name: "Marketing Coach", description: "Reviews affiliate performance and suggests next actions", defaultPromptSlug: "marketing-coach" },
];

export const PROMPT_CATEGORIES = ["writer", "analyzer", "generator", "planner", "coach", "general"] as const;
