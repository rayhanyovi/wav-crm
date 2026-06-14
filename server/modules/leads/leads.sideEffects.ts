import type { Lead, Prisma } from "../../../prisma/generated/client/index.js";
import type { Tx } from "../../lib/prisma.js";

/**
 * App-layer port of the Postgres triggers that fired on the `leads` table:
 *   • fn_lead_status_side_effects  → abandonment flag + lead_status_history
 *   • fn_notify_appointment_set    → APPOINTMENT_SET notification
 *   • fn_notify_lead_assigned      → LEAD_ASSIGNED notifications (assignee + TM)
 *   • fn_notify_lead_bounced       → LEAD_BOUNCED notification
 *   • fn_audit_log                 → audit_logs row
 *
 * Captured from the live DB on 2026-06-14. See docs/04-SIDE-EFFECTS.md for the
 * original SQL. Keep this in lock-step with the schema; these are the rules the
 * rest of the system depends on but never sees.
 */

function fullName(lead: Pick<Lead, "firstName" | "lastName">): string {
  return `${lead.firstName} ${lead.lastName}`.trim() || "A lead";
}

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

/** Builds the notification rows implied by a lead transition (no I/O). */
export function buildLeadNotifications(prev: Lead, next: Lead): Prisma.NotificationCreateManyInput[] {
  const rows: Prisma.NotificationCreateManyInput[] = [];
  const name = fullName(next);

  if (next.status === "APPOINTMENT" && prev.status !== "APPOINTMENT" && next.assignedToId) {
    rows.push({
      recipientId: next.assignedToId,
      type: "APPOINTMENT_SET",
      title: "Appointment set",
      message: `${name}${next.appointmentDate ? ` - ${next.appointmentDate}` : ""}.`,
      entityType: "lead",
      entityId: next.id,
    });
  }

  if (next.assignedToId && next.assignedToId !== prev.assignedToId) {
    rows.push({
      recipientId: next.assignedToId,
      type: "LEAD_ASSIGNED",
      title: "Lead assigned to you",
      message: `${name} has been assigned to you.`,
      entityType: "lead",
      entityId: next.id,
    });
  }

  if (next.telemarketerOwnerId && next.telemarketerOwnerId !== prev.telemarketerOwnerId) {
    rows.push({
      recipientId: next.telemarketerOwnerId,
      type: "LEAD_ASSIGNED",
      title: "Lead assigned to your queue",
      message: `${name} has been added to your calling queue.`,
      entityType: "lead",
      entityId: next.id,
    });
  }

  if ((next.bounceCount ?? 0) > (prev.bounceCount ?? 0) && prev.telemarketerOwnerId) {
    rows.push({
      recipientId: prev.telemarketerOwnerId,
      type: "LEAD_BOUNCED",
      title: "Lead back in your queue",
      message: `${name} was a no-show and moved back to your queue.`,
      entityType: "lead",
      entityId: next.id,
    });
  }

  return rows;
}

export async function emitLeadNotifications(tx: Tx, prev: Lead, next: Lead): Promise<void> {
  const rows = buildLeadNotifications(prev, next);
  if (rows.length > 0) await tx.notification.createMany({ data: rows });
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
