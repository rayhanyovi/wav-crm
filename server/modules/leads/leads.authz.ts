import type { Actor } from "../../middleware/context.js";

/**
 * App-layer port of the `leads` RLS policies (the backend bypasses RLS).
 * Source of truth captured from the live DB on 2026-06-14 — see
 * docs/03-AUTHZ-MATRIX.md.
 *
 * ⚠️ DISCREPANCY (carried over deliberately, flagged for product):
 *   The live RLS gates ADVISER access to leads on `telemarketer_access`, while
 *   the frontend `hasLeadsAccess()` uses the separate `leads_access` column.
 *   We mirror the DB (`telemarketerAccess`) so server behaviour is unchanged by
 *   the migration. Resolve which flag is canonical, then update both sides.
 */

/** leads_select / leads_update: MASTER, TELEMARKETER, or ADVISER w/ telemarketer access. */
function canWorkLeadPool(actor: Actor): boolean {
  if (actor.role === "MASTER" || actor.role === "TELEMARKETER") return true;
  return actor.role === "ADVISER" && actor.telemarketerAccess;
}

export const canListLeads = canWorkLeadPool;
export const canUpdateLead = canWorkLeadPool;

/** leads_insert: any authenticated CRM user. */
export function canCreateLead(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER" || actor.role === "TELEMARKETER";
}

/** A single lead is viewable by anyone who can work the pool. */
export const canViewLead = canWorkLeadPool;

/** leads_delete: MASTER, or the assigned/adviser owner of the row. */
export function canDeleteLead(
  actor: Actor,
  lead: { assignedToId: string | null; adviserOwnerId: string | null },
): boolean {
  if (actor.role === "MASTER") return true;
  return lead.assignedToId === actor.id || lead.adviserOwnerId === actor.id;
}

/**
 * ADVISER claiming an APPOINTMENT lead (costs 1 credit).
 * MASTER can always claim.
 */
export function canClaimAppointmentLead(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER";
}

/**
 * TM/Adviser claiming a pool of NA/COOLDOWN leads for a calling session.
 * Anyone who can work the pool can claim for a call.
 */
export const canClaimForCall = canWorkLeadPool;

/**
 * Converting a lead to APPOINTMENT: TM or Adviser-with-leads or MASTER.
 */
export const canConvertLead = canWorkLeadPool;
