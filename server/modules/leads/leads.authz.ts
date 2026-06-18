import type { Actor } from "../../middleware/context.js";

interface LeadScope {
  assignedToId: string | null;
  telemarketerOwnerId: string | null;
  adviserOwnerId: string | null;
}

export function canListLeads(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER" || actor.role === "TELEMARKETER";
}

export function canViewLead(actor: Actor, lead: LeadScope, sharedAdviserIds: string[] = []): boolean {
  if (actor.role === "MASTER") return true;
  if (actor.role === "TELEMARKETER") {
    return (
      lead.telemarketerOwnerId === actor.id ||
      lead.telemarketerOwnerId === null ||
      (lead.assignedToId !== null && sharedAdviserIds.includes(lead.assignedToId)) ||
      (lead.adviserOwnerId !== null && sharedAdviserIds.includes(lead.adviserOwnerId))
    );
  }
  if (actor.role === "ADVISER") {
    if (actor.leadsAccess) return true;
    return lead.assignedToId === actor.id || lead.adviserOwnerId === actor.id;
  }
  return false;
}

export function canUpdateLead(actor: Actor, lead: LeadScope, sharedAdviserIds: string[] = []): boolean {
  if (actor.role === "MASTER") return true;
  if (actor.role === "TELEMARKETER") {
    return (
      lead.telemarketerOwnerId === actor.id ||
      (lead.assignedToId !== null && sharedAdviserIds.includes(lead.assignedToId)) ||
      (lead.adviserOwnerId !== null && sharedAdviserIds.includes(lead.adviserOwnerId))
    );
  }
  if (actor.role === "ADVISER") {
    if (actor.leadsAccess) return true;
    return lead.assignedToId === actor.id || lead.adviserOwnerId === actor.id;
  }
  return false;
}

/** leads_insert: any authenticated CRM user. */
export function canCreateLead(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER" || actor.role === "TELEMARKETER";
}

/** leads_delete: MASTER, or any owner of the row — assigned adviser, adviser
 *  owner, or the telemarketer whose queue it sits in (so a TM can clean up the
 *  leads they imported, e.g. accidental duplicate uploads). */
export function canDeleteLead(
  actor: Actor,
  lead: { assignedToId: string | null; adviserOwnerId: string | null; telemarketerOwnerId?: string | null },
): boolean {
  if (actor.role === "MASTER") return true;
  return (
    lead.assignedToId === actor.id ||
    lead.adviserOwnerId === actor.id ||
    lead.telemarketerOwnerId === actor.id
  );
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
  return (
    actor.role === "MASTER" ||
    actor.role === "TELEMARKETER" ||
    actor.telemarketerAccess ||
    (actor.role === "ADVISER" && actor.leadsAccess)
  );
}

/**
 * Converting a lead to APPOINTMENT: MASTER, any TELEMARKETER, or an ADVISER who
 * works the cold-call pool (leads access) — the same people who can book an
 * appointment from the calling flow. `telemarketerAccess` is also honoured for
 * advisers explicitly granted dealing access.
 */
export function canConvertLead(actor: Actor): boolean {
  return (
    actor.role === "MASTER" ||
    actor.role === "TELEMARKETER" ||
    actor.telemarketerAccess ||
    (actor.role === "ADVISER" && actor.leadsAccess)
  );
}
