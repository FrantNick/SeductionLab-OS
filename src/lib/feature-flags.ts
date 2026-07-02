import { prisma } from "@/lib/prisma";

/**
 * DB-backed feature flags — toggled from /admin/settings without a
 * redeploy. Unknown flags fall back to their registered default so a
 * missing row can never crash a page.
 */

export const FLAG_DEFS = [
  { key: "ai", name: "AI features", description: "AI chat, prompts, model configs", default: true },
  { key: "experiments", name: "Experiments", description: "Time-bound campaign tests", default: true },
  { key: "integrations", name: "Integrations", description: "External service connections", default: true },
  { key: "proxies", name: "Proxy management", description: "Outbound proxy routing", default: true },
  { key: "beta", name: "Beta features", description: "Unreleased functionality", default: false },
] as const;

export type FlagKey = (typeof FLAG_DEFS)[number]["key"];

export async function isFlagEnabled(key: FlagKey): Promise<boolean> {
  const def = FLAG_DEFS.find((f) => f.key === key);
  const row = await prisma.featureFlag.findUnique({ where: { key } });
  return row?.enabled ?? def?.default ?? false;
}

/** All flags merged with registry defaults (for settings UI + layouts). */
export async function getAllFlags(): Promise<
  { key: FlagKey; name: string; description: string; enabled: boolean }[]
> {
  const rows = await prisma.featureFlag.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.enabled]));
  return FLAG_DEFS.map((def) => ({
    key: def.key,
    name: def.name,
    description: def.description,
    enabled: byKey.get(def.key) ?? def.default,
  }));
}

export async function setFlag(key: FlagKey, enabled: boolean): Promise<void> {
  const def = FLAG_DEFS.find((f) => f.key === key);
  if (!def) throw new Error(`Unknown feature flag: ${key}`);
  await prisma.featureFlag.upsert({
    where: { key },
    create: { key, name: def.name, description: def.description, enabled },
    update: { enabled },
  });
}
