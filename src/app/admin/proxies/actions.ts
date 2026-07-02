"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { checkProxyHealth } from "@/lib/proxies";

const proxySchema = z.object({
  name: z.string().min(2).max(80),
  provider: z.string().max(80).default(""),
  kind: z.enum(["RESIDENTIAL", "DATACENTER", "MOBILE"]),
  protocol: z.enum(["HTTP", "HTTPS", "SOCKS5"]),
  host: z.string().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().max(255).default(""),
  password: z.string().default(""),
});

export async function createProxy(formData: FormData) {
  const session = await requireAdmin();
  const data = proxySchema.parse({
    name: formData.get("name"),
    provider: formData.get("provider") ?? "",
    kind: formData.get("kind"),
    protocol: formData.get("protocol"),
    host: formData.get("host"),
    port: formData.get("port"),
    username: formData.get("username") ?? "",
    password: formData.get("password") ?? "",
  });

  const proxy = await prisma.proxy.create({
    data: {
      name: data.name,
      provider: data.provider,
      kind: data.kind,
      protocol: data.protocol,
      host: data.host,
      port: data.port,
      username: data.username || null,
      passwordEncrypted: data.password ? encryptSecret(data.password) : null,
    },
  });
  await logAudit({
    userId: session.user.id,
    action: "proxy.created",
    entityType: "proxy",
    entityId: proxy.id,
    metadata: { name: proxy.name },
  });
  revalidatePath("/admin/proxies");
}

export async function toggleProxy(proxyId: string, enabled: boolean) {
  await requireAdmin();
  await prisma.proxy.update({ where: { id: proxyId }, data: { enabled } });
  revalidatePath("/admin/proxies");
}

export async function deleteProxy(proxyId: string) {
  const session = await requireAdmin();
  await prisma.proxy.delete({ where: { id: proxyId } });
  await logAudit({
    userId: session.user.id,
    action: "proxy.deleted",
    entityType: "proxy",
    entityId: proxyId,
  });
  revalidatePath("/admin/proxies");
}

export async function testProxy(proxyId: string) {
  await requireAdmin();
  await checkProxyHealth(proxyId);
  revalidatePath("/admin/proxies");
}

/** Assign (or clear) the proxy used by a service ("apify", "ai", …). */
export async function assignProxy(service: string, formData: FormData) {
  const session = await requireAdmin();
  const proxyId = String(formData.get("proxyId") ?? "");

  if (!proxyId) {
    await prisma.proxyAssignment.deleteMany({ where: { service } });
  } else {
    await prisma.proxyAssignment.upsert({
      where: { service },
      create: { service, proxyId },
      update: { proxyId },
    });
  }
  await logAudit({
    userId: session.user.id,
    action: "proxy.assigned",
    entityType: "proxy-assignment",
    entityId: service,
    metadata: { proxyId: proxyId || null },
  });
  revalidatePath("/admin/proxies");
}
