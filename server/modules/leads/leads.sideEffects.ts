import type { Lead, Prisma } from "../../../prisma/generated/client/index.js";
import type { Tx } from "../../lib/prisma.js";

/**
 * App-layer port of the Postgres triggers that fired on the `leads` table:
 *   • fn_lead_status_side_effects  → abandonment flag + lead_status_history
 *   • fn_audit_log                 → audit_logs row
 *
 * Captured from the live DB on 2026-06-14. Lead transition notifications are
 * intentionally disabled for now; notification bell traffic is limited to
 * appointment/callback reminders in notifications.service.ts.
 */

/**
 * Column derivations applied to a status transition BEFORE the row is written
 * (port of the BEFORE-UPDATE trigger). Returns the extra fields to merge in.
 */
export function deriveStatusColumns(
  prevStatus: Lead["status"],
  nextStatus: Lead["status"],
): Partial<Pick<Lead, "isAbandoned" | "abandonedAt">> {
  if (nextStatus === "AVOID" && prevStatus !== "AVOID") {
    return { isAbandoned: true, abandonedAt: new Date() };
  }
  if (prevStatus === "AVOID" && nextStatus !== "AVOID") {
    return { isAbandoned: false, abandonedAt: null };
  }
  return {};
}

/** Writes a lead_status_history row when the status actually changed. */
export async function recordStatusHistory(
  tx: Tx,
  args: { leadId: string; prevStatus: Lead["status"]; nextStatus: Lead["status"]; changedBy: string },
): Promise<void> {
  if (args.prevStatus === args.nextStatus) return;
  await tx.leadStatusHistory.create({
    data: { leadId: args.leadId, status: args.nextStatus, changedBy: args.changedBy },
  });
}

/** Lead transition notifications are intentionally muted. */
export function buildLeadNotifications(prev: Lead, next: Lead): Prisma.NotificationCreateManyInput[] {
  void prev;
  void next;
  return [];
}

export async function emitLeadNotifications(tx: Tx, prev: Lead, next: Lead): Promise<void> {
  const rows = buildLeadNotifications(prev, next);
  if (rows.length > 0) await tx.notification.createMany({ data: rows });
}

const STATUS_LABELS: Record<string, string> = {
  NA: "NA",
  APPOINTMENT: "Appointment",
  NOT_INTERESTED: "Not Interested",
  AVOID: "Avoid",
  KIV: "KIV",
  OTHERS: "Others",
  COOLDOWN: "Cooldown",
};

/** Auto-creates a LeadNote entry when status changes, so the transition is visible in the Notes Log. */
export async function recordStatusNote(
  tx: Tx,
  args: { leadId: string; prevStatus: Lead["status"]; nextStatus: Lead["status"]; changedBy: string },
): Promise<void> {
  if (args.prevStatus === args.nextStatus) return;
  const from = STATUS_LABELS[args.prevStatus] ?? args.prevStatus;
  const to = STATUS_LABELS[args.nextStatus] ?? args.nextStatus;
  await tx.leadNote.create({
    data: {
      leadId: args.leadId,
      content: `Status changed from ${from} to ${to}`,
      createdBy: args.changedBy,
    },
  });
}

/** Port of fn_audit_log for the leads table. */
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
      entityType: "leads",
      entityId: args.entityId,
      metadata: { old: args.old ?? null, new: args.next ?? null } as Prisma.InputJsonValue,
    },
  });
}
