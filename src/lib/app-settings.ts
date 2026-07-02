import { prisma } from "@/lib/prisma";

/**
 * Runtime-configurable platform settings, stored as JSON values in the
 * AppSetting table. Registered defaults mean a missing row never breaks
 * anything. Secrets never live here — see Integration / AiProvider.
 */

export const SETTING_DEFS = {
  "branding.appName": { label: "App name", default: "Seduction Lab OS" },
  "branding.tagline": { label: "Tagline", default: "Marketing experimentation & attribution" },
  "tracking.domain": { label: "Tracking domain", default: "" }, // falls back to env
  "defaults.currency": { label: "Currency", default: "USD" },
  "defaults.leaderboardSize": { label: "Leaderboard size", default: 50 },
  "defaults.metricsRefreshHours": { label: "Metrics refresh cadence (hours)", default: 6 },
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;

export async function getSetting<T = string>(key: SettingKey): Promise<T> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row) return row.value as T;
  return SETTING_DEFS[key].default as T;
}

export async function getAllSettings(): Promise<Record<SettingKey, unknown>> {
  const rows = await prisma.appSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const result = {} as Record<SettingKey, unknown>;
  for (const key of Object.keys(SETTING_DEFS) as SettingKey[]) {
    result[key] = byKey.get(key) ?? SETTING_DEFS[key].default;
  }
  return result;
}

export async function setSetting(key: SettingKey, value: unknown): Promise<void> {
  if (!(key in SETTING_DEFS)) throw new Error(`Unknown setting: ${key}`);
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}
