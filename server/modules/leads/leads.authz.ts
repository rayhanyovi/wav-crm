import type { Actor } from "../../middleware/context.js";

interface LeadScope {
  assignedToId: string | null;
  telemarketerOwnerId: string | null;
  adviserOwnerId: string | null;
}

export function canListLeads(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER" || actor.role === "TELEMARKETER";
}

export function canViewLead(actor: Actor, lead: LeadScope): boolean {
  if (actor.role === "MASTER") return true;
  if (actor.role === "TELEMARKETER") {
    return lead.telemarketerOwnerId === actor.id || lead.telemarketerOwnerId === null;
  }
  if (actor.role === "ADVISER") {
    return lead.assignedToId === actor.id || lead.adviserOwnerId === actor.id;
  }
  return false;
}

export function canUpdateLead(actor: Actor, lead: LeadScope): boolean {
  if (actor.role === "MASTER") return true;
  if (actor.role === "TELEMARKETER") return lead.telemarketerOwnerId === actor.id;
  if (actor.role === "ADVISER") {
    return lead.assignedToId === actor.id || lead.adviserOwnerId === actor.id;
  }
  return false;
}

/** leads_insert: any authenticated CRM user. */
export function canCreateLead(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER" || actor.role === "TELEMARKETER";
}

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
export function canClaimForCall(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "TELEMARKETER" || actor.telemarketerAccess;
}

/**
 * Converting a lead to APPOINTMENT: TM or Adviser-with-leads or MASTER.
 */
export function canConvertLead(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "TELEMARKETER" || actor.telemarketerAccess;
}
