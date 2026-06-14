import type { Actor } from "../../middleware/context.js";

/** MASTER and ADVISER can work contacts; TELEMARKETER cannot. */
function canWorkContacts(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER";
}

export const canListContacts = canWorkContacts;
export const canViewContact = canWorkContacts;
export const canCreateContact = canWorkContacts;
export const canUpdateContact = canWorkContacts;

export function canDeleteContact(actor: Actor): boolean {
  return actor.role === "MASTER";
}
