"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { setSetting, SETTING_DEFS, type SettingKey } from "@/lib/app-settings";
import { setFlag, type FlagKey } from "@/lib/feature-flags";

export async function saveAppSettings(formData: FormData) {
  const session = await requireAdmin();

  for (const key of Object.keys(SETTING_DEFS) as SettingKey[]) {
    const raw = formData.get(key);
    if (raw === null) continue;
    const def = SETTING_DEFS[key];
    const value = typeof def.default === "number" ? Number(raw) || def.default : String(raw);
    await setSetting(key, value);
  }

  await logAudit({
    userId: session.user.id,
    action: "settings.changed",
    entityType: "settings",
  });
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
}

export async function toggleFeatureFlag(key: FlagKey, enabled: boolean) {
  const session = await requireAdmin();
  await setFlag(key, enabled);
  await logAudit({
    userId: session.user.id,
    action: "flag.toggled",
    entityType: "flag",
    entityId: key,
    metadata: { enabled },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard", "layout");
}
