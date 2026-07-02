import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";

/**
 * Integration registry. Each entry describes an external service the
 * platform can connect to: how its credential is labelled, what non-
 * secret config it needs, and how to validate it (when a real check is
 * possible against the live API).
 *
 * Integrations with no credential stay "unconfigured" — the platform
 * never pretends a service is connected.
 */

export type IntegrationDef = {
  slug: string;
  name: string;
  description: string;
  credentialLabel: string;
  configFields: { key: string; label: string; placeholder: string }[];
  /** Validates the credential against the real API; null = config-only for now. */
  validate: ((credential: string, config: Record<string, string>) => Promise<{ ok: boolean; detail: string }>) | null;
};

async function checkHttp(
  url: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    return res.ok
      ? { ok: true, detail: "Credentials valid" }
      : { ok: false, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "Connection failed" };
  }
}

export const INTEGRATION_DEFS: IntegrationDef[] = [
  {
    slug: "apify",
    name: "Apify",
    description: "Twitter/X thread metrics scraping (powers ThreadMetrics)",
    credentialLabel: "API token",
    configFields: [
      { key: "actorId", label: "Actor ID", placeholder: "goat255~twitter-tweet-scraper" },
    ],
    validate: (token) =>
      checkHttp("https://api.apify.com/v2/users/me", { Authorization: `Bearer ${token}` }),
  },
  {
    slug: "stripe",
    name: "Stripe",
    description: "Payment webhooks for automatic conversion attribution (V2 roadmap)",
    credentialLabel: "Secret key",
    configFields: [{ key: "webhookSecret", label: "Webhook signing secret", placeholder: "whsec_…" }],
    validate: (key) =>
      checkHttp("https://api.stripe.com/v1/balance", { Authorization: `Bearer ${key}` }),
  },
  {
    slug: "shopify",
    name: "Shopify",
    description: "Store order attribution (V2 roadmap)",
    credentialLabel: "Admin API access token",
    configFields: [{ key: "shopDomain", label: "Shop domain", placeholder: "your-store.myshopify.com" }],
    validate: null, // needs per-shop domain; wired when webhook work lands
  },
  {
    slug: "gumroad",
    name: "Gumroad",
    description: "Sale webhooks for automatic conversions (V2 roadmap)",
    credentialLabel: "Access token",
    configFields: [],
    validate: null,
  },
  {
    slug: "openai",
    name: "OpenAI",
    description: "LLM provider — configure models under Admin → AI",
    credentialLabel: "API key",
    configFields: [],
    validate: (key) =>
      checkHttp("https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` }),
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    description: "LLM provider — configure models under Admin → AI",
    credentialLabel: "API key",
    configFields: [],
    validate: (key) =>
      checkHttp("https://api.anthropic.com/v1/models", {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      }),
  },
  {
    slug: "openrouter",
    name: "OpenRouter",
    description: "Multi-model LLM gateway — configure models under Admin → AI",
    credentialLabel: "API key",
    configFields: [],
    validate: (key) =>
      checkHttp("https://openrouter.ai/api/v1/models", { Authorization: `Bearer ${key}` }),
  },
];

/** Decrypted credential for an enabled integration, or null. */
export async function getIntegrationCredential(slug: string): Promise<string | null> {
  const row = await prisma.integration.findUnique({ where: { slug } });
  if (!row || !row.enabled || !row.credentialEncrypted) return null;
  try {
    return decryptSecret(row.credentialEncrypted);
  } catch {
    return null;
  }
}

export async function getIntegrationConfig(slug: string): Promise<Record<string, string>> {
  const row = await prisma.integration.findUnique({ where: { slug } });
  return (row?.config as Record<string, string>) ?? {};
}
