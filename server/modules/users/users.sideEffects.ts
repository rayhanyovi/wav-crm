import type { Prisma } from "../../../prisma/generated/client/index.js";
import type { Tx } from "../../lib/prisma.js";

export async function writeAuditLog(
  tx: Tx,
  args: {
    userId: string;
    action: "UPDATE";
    entityId: string;
    old: unknown;
    next: unknown;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: args.userId,
      action: args.action,
      entityType: "crm_users",
      entityId: args.entityId,
      metadata: { old: args.old ?? null, new: args.next ?? null } as Prisma.InputJsonValue,
    },
  });
}
