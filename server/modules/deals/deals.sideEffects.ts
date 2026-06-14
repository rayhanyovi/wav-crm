import type { Deal, DealStage, Prisma } from "../../../prisma/generated/client/index.js";
import type { Tx } from "../../lib/prisma.js";

/** Writes a stage_history row on every stage transition. */
export async function recordStageHistory(
  tx: Tx,
  args: {
    dealId: string;
    fromStage: DealStage | null | undefined;
    toStage: DealStage;
    changedBy: string;
    note?: string;
  },
): Promise<void> {
  await tx.stageHistory.create({
    data: {
      dealId: args.dealId,
      fromStage: args.fromStage ?? undefined,
      toStage: args.toStage,
      changedBy: args.changedBy,
      note: args.note,
    },
  });
}

/** Builds notification rows for a stage transition (no I/O). */
export function buildDealNotifications(
  deal: Pick<Deal, "id" | "title" | "assignedToId">,
  toStage: DealStage,
): Prisma.NotificationCreateManyInput[] {
  if (!deal.assignedToId) return [];
  return [
    {
      recipientId: deal.assignedToId,
      type: "DEAL_STAGE_CHANGED",
      title: "Deal stage changed",
      message: `Deal "${deal.title}" moved to ${toStage}.`,
      entityType: "deal",
      entityId: deal.id,
    },
  ];
}

export async function emitDealNotifications(
  tx: Tx,
  deal: Pick<Deal, "id" | "title" | "assignedToId">,
  toStage: DealStage,
): Promise<void> {
  const rows = buildDealNotifications(deal, toStage);
  if (rows.length > 0) await tx.notification.createMany({ data: rows });
}

/** Port of fn_audit_log for the deals table. */
export async function writeAuditLog(
  tx: Tx,
  args: {
    userId: string;
    action: "CREATE" | "UPDATE" | "DELETE";
    entityId: string;
    old: unknown;
    next: unknown;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: args.userId,
      action: args.action,
      entityType: "deals",
      entityId: args.entityId,
      metadata: { old: args.old ?? null, new: args.next ?? null } as Prisma.InputJsonValue,
    },
  });
}
