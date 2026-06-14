import type { Actor } from "../../middleware/context.js";

/** Everyone can call list; the query filters results per role. */
export function canListDeals(_actor: Actor): boolean {
  return true;
}

/** MASTER or ADVISER can create deals directly. */
export function canCreateDeal(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER";
}

/**
 * MASTER sees all deals.
 * ADVISER sees deals assigned to them OR the open APPOINTMENT pool (assignedToId=null).
 * TELEMARKETER sees deals linked to their leads (telemarketerId = actor.id) OR
 * deals assigned to an adviser who delegated dealing access to them.
 */
export function canViewDeal(
  actor: Actor,
  deal: { assignedToId: string | null; telemarketerId: string | null },
): boolean {
  if (actor.role === "MASTER") return true;
  if (actor.role === "ADVISER") return deal.assignedToId === actor.id || deal.assignedToId === null;
  if (actor.role === "TELEMARKETER") {
    if (deal.telemarketerId === actor.id) return true;
    return deal.assignedToId !== null && actor.delegatedAdviserIds.includes(deal.assignedToId);
  }
  return false;
}

/**
 * MASTER can mutate any deal.
 * ADVISER can only mutate deals they are assigned to.
 * TELEMARKETER can mutate deals assigned to an adviser who delegated to them
 * (acting on that adviser's behalf — proposals, stage, etc.).
 */
export function canMutateDeal(
  actor: Actor,
  deal: { assignedToId: string | null },
): boolean {
  if (actor.role === "MASTER") return true;
  if (actor.role === "ADVISER") return deal.assignedToId === actor.id;
  if (actor.role === "TELEMARKETER") {
    return deal.assignedToId !== null && actor.delegatedAdviserIds.includes(deal.assignedToId);
  }
  return false;
}

/** MASTER or ADVISER can claim (credit is checked separately in service). */
export function canClaimDeal(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER";
}

/** Only MASTER can hard-/soft-delete deals. */
export function canDeleteDeal(actor: Actor): boolean {
  return actor.role === "MASTER";
}
