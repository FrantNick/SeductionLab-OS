import { prisma } from "@/lib/prisma";

export type AuditAction =
  | `product.${"created" | "updated" | "archived" | "restored"}`
  | `campaign.${"created" | "updated" | "status_changed"}`
  | `assignment.${"created" | "status_changed"}`
  | `affiliate.${"status_changed" | "settings_changed"}`
  | `conversion.${"created"}`
  | `settings.${"changed"}`
  | `flag.${"toggled"}`
  | `integration.${"configured" | "toggled"}`
  | `ai.${"provider_configured" | "model_configured" | "prompt_created" | "prompt_activated" | "knowledge_deleted"}`
  | `proxy.${"created" | "updated" | "deleted" | "assigned"}`
  | `experiment.${"created" | "updated" | "status_changed"}`
  | `job.${"triggered"}`
  | `user.${"password_changed"}`;

/**
 * Fire-and-forget audit trail. Auditing must never break the action it
 * records, so failures are logged and swallowed.
 */
export async function logAudit(entry: {
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? "",
        entityId: entry.entityId ?? "",
        metadata: entry.metadata as object | undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", entry.action, err);
  }
}
