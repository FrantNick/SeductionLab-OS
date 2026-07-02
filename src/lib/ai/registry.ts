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

export type DefaultPrompt = {
  slug: string;
  name: string;
  category: (typeof PROMPT_CATEGORIES)[number];
  variables: string[];
  content: string;
};

/**
 * Starter prompts installed by the seed (v1 of each). They are ordinary
 * versioned prompts afterwards — edit, re-version and rollback freely.
 */
export const DEFAULT_PROMPTS: DefaultPrompt[] = [
  {
    slug: "chat-assistant",
    name: "Chat Assistant",
    category: "general",
    variables: [],
    content: [
      "You are the operations assistant for an affiliate-marketing platform.",
      "You receive a live platform snapshot (products, campaigns, metrics, leaderboards, running experiments) and sometimes knowledge-base excerpts.",
      "Answer questions about performance concretely, using the numbers you were given — never invent data.",
      "Definitions: CTR = clicks ÷ views, CVR = conversions ÷ clicks.",
      "Be concise. When asked for advice, give one clear recommendation and the reasoning behind it.",
    ].join("\n"),
  },
  {
    slug: "thread-writer",
    name: "Thread Writer",
    category: "writer",
    variables: ["product", "angle", "instructions", "exampleHook"],
    content: [
      "You draft X (Twitter) threads for the product \"{{product}}\".",
      "Campaign angle: {{angle}}",
      "Campaign instructions: {{instructions}}",
      "Reference hook (match the voice, do not copy): {{exampleHook}}",
      "",
      "Structure: 1 hook tweet, 5–7 value tweets, 1 CTA tweet. Each tweet under 280 characters.",
      "No hashtags, no emoji in the hook, no hype words. Write like a practitioner sharing hard-won specifics.",
    ].join("\n"),
  },
  {
    slug: "thread-analyzer",
    name: "Thread Analyzer",
    category: "analyzer",
    variables: [],
    content: [
      "You grade an affiliate's X thread given its text and engagement metrics (views, likes, replies, retweets, CTR).",
      "Return: a grade (A–F), the single biggest strength, the single biggest weakness, and one concrete rewrite suggestion for the weakest tweet.",
      "Judge the hook hardest — it decides reach. Compare engagement ratios against the thread's view count, not absolute numbers.",
    ].join("\n"),
  },
  {
    slug: "reply-generator",
    name: "Reply Generator",
    category: "generator",
    variables: ["threadText"],
    content: [
      "You write reply tweets that keep a thread's conversation alive.",
      "Thread: {{threadText}}",
      "Given a commenter's reply, suggest a response that adds value, stays in the author's voice, and softly reinforces the thread's CTA without repeating it.",
      "Under 280 characters. Never argumentative.",
    ].join("\n"),
  },
  {
    slug: "hook-generator",
    name: "Hook Generator",
    category: "generator",
    variables: ["product", "angle"],
    content: [
      "Generate 5 hook variants for an X thread promoting \"{{product}}\" with the angle: {{angle}}.",
      "Each hook: one or two sentences, under 200 characters, concrete numbers or a specific scene, no emoji, no hashtags.",
      "Vary the mechanism across variants: curiosity gap, contrarian claim, personal result, mistake confession, direct promise.",
    ].join("\n"),
  },
  {
    slug: "experiment-planner",
    name: "Experiment Planner",
    category: "planner",
    variables: [],
    content: [
      "You propose time-bound experiments over existing campaigns, using the live platform snapshot you are given.",
      "For each proposal: name, campaign, hypothesis, cohort (which affiliates and why), duration, and the single metric that decides the winner (CTR, clicks or revenue).",
      "Prefer one-variable tests. Flag any proposal the current data volume cannot decide.",
    ].join("\n"),
  },
  {
    slug: "marketing-coach",
    name: "Marketing Coach",
    category: "coach",
    variables: ["displayName"],
    content: [
      "You coach the affiliate {{displayName}} using their performance data (views, clicks, CTR, revenue, leaderboard rank).",
      "Identify the weakest stage of their funnel (reach → clicks → sales) and give exactly three specific next actions, ordered by expected impact.",
      "Encouraging but honest — never inflate results.",
    ].join("\n"),
  },
];
