import type { AiProviderKind } from "@prisma/client";

/**
 * Thin HTTP adapters over provider wire formats. Exactly two formats
 * cover every supported provider today:
 *
 *  - OPENAI_COMPATIBLE → POST {baseUrl}/chat/completions
 *    (OpenAI, OpenRouter, Google-compat, DeepSeek, Groq, Together,
 *     Fireworks, Ollama, LM Studio)
 *  - ANTHROPIC → POST {baseUrl}/messages
 *
 * Adapters know nothing about features, prompts or the database —
 * the service layer resolves configuration and hands them a request.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatRequest = {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
};

export type ChatResult = {
  content: string;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export class AiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 120_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AiRequestError(res.status, `Provider error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function chatOpenAiCompatible(req: ChatRequest): Promise<ChatResult> {
  const data = await postJson(
    `${req.baseUrl.replace(/\/$/, "")}/chat/completions`,
    { Authorization: `Bearer ${req.apiKey}` },
    {
      model: req.model,
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    },
  );
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new AiRequestError(502, "Provider returned no content");
  return {
    content,
    usage: {
      inputTokens: data?.usage?.prompt_tokens,
      outputTokens: data?.usage?.completion_tokens,
    },
  };
}

async function chatAnthropic(req: ChatRequest): Promise<ChatResult> {
  const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const messages = req.messages.filter((m) => m.role !== "system");

  const data = await postJson(
    `${req.baseUrl.replace(/\/$/, "")}/messages`,
    { "x-api-key": req.apiKey, "anthropic-version": "2023-06-01" },
    {
      model: req.model,
      system: system || undefined,
      messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    },
  );
  const content = Array.isArray(data?.content)
    ? data.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("")
    : null;
  if (!content) throw new AiRequestError(502, "Provider returned no content");
  return {
    content,
    usage: { inputTokens: data?.usage?.input_tokens, outputTokens: data?.usage?.output_tokens },
  };
}

export async function chat(kind: AiProviderKind, req: ChatRequest): Promise<ChatResult> {
  switch (kind) {
    case "ANTHROPIC":
      return chatAnthropic(req);
    case "OPENAI_COMPATIBLE":
    case "GOOGLE": // Google is served via its OpenAI-compatible endpoint
      return chatOpenAiCompatible(req);
  }
}

/** Cheap credential check: list models (both formats expose GET /models). */
export async function validateCredentials(
  kind: AiProviderKind,
  baseUrl: string,
  apiKey: string,
): Promise<{ ok: boolean; detail: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}/models`;
  const headers: Record<string, string> =
    kind === "ANTHROPIC"
      ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
      : { Authorization: `Bearer ${apiKey}` };
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (res.ok) return { ok: true, detail: "Credentials valid" };
    return { ok: false, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "Connection failed" };
  }
}
