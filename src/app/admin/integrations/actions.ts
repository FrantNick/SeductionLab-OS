"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { INTEGRATION_DEFS } from "@/lib/integrations";

/**
 * Saves an integration's credential + config and, when the registry
 * defines a validator, checks the credential against the live API so
 * status reflects reality — never assumed.
 */
export async function saveIntegration(slug: string, formData: FormData) {
  const session = await requireAdmin();
  const def = INTEGRATION_DEFS.find((d) => d.slug === slug);
  if (!def) throw new Error(`Unknown integration: ${slug}`);

  const credential = z.string().parse(formData.get("credential") ?? "");
  const config: Record<string, string> = {};
  for (const field of def.configFields) {
    config[field.key] = String(formData.get(`config.${field.key}`) ?? "");
  }

  const existing = await prisma.integration.findUnique({ where: { slug } });
  const credentialEncrypted = credential
    ? encryptSecret(credential)
    : (existing?.credentialEncrypted ?? null);

  let status = existing?.status ?? "unconfigured";
  let statusDetail = existing?.statusDetail ?? "";
  if (credential && def.validate) {
    const result = await def.validate(credential, config);
    status = result.ok ? "ok" : "error";
    statusDetail = result.detail;
  } else if (credential) {
    status = "ok";
    statusDetail = "Credential stored (no live validation available)";
  }

  await prisma.integration.upsert({
    where: { slug },
    create: {
      slug,
      name: def.name,
      credentialEncrypted,
      config,
      enabled: Boolean(credentialEncrypted),
      status,
      statusDetail,
      lastCheckedAt: credential ? new Date() : null,
    },
    update: {
      credentialEncrypted,
      config,
      ...(credential
        ? { status, statusDetail, lastCheckedAt: new Date(), enabled: true }
        : { config }),
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "integration.configured",
    entityType: "integration",
    entityId: slug,
    metadata: { status },
  });
  revalidatePath("/admin/integrations");
}

export async function toggleIntegration(slug: string, enabled: boolean) {
  const session = await requireAdmin();
  await prisma.integration.update({ where: { slug }, data: { enabled } });
  await logAudit({
    userId: session.user.id,
    action: "integration.toggled",
    entityType: "integration",
    entityId: slug,
    metadata: { enabled },
  });
  revalidatePath("/admin/integrations");
}
