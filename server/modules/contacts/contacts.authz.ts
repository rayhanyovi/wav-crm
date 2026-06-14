import type { Actor } from "../../middleware/context.js";

interface ContactScope {
  createdBy: string;
}

/** Contacts are readable by role, with TELEMARKETER rows scoped in service. */
export function canListContacts(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER" || actor.role === "TELEMARKETER";
}

export function canViewContact(actor: Actor, contact: ContactScope, sharedAdviserIds: string[] = []): boolean {
  if (actor.role === "MASTER" || actor.role === "ADVISER") return true;
  if (actor.role === "TELEMARKETER") {
    return contact.createdBy === actor.id || sharedAdviserIds.includes(contact.createdBy);
  }
  return false;
}

/** TMs can create contacts generated from their calling workflow. */
export function canCreateContact(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER" || actor.role === "TELEMARKETER";
}

export function canUpdateContact(actor: Actor, contact: ContactScope, sharedAdviserIds: string[] = []): boolean {
  if (actor.role === "MASTER" || actor.role === "ADVISER") return true;
  if (actor.role === "TELEMARKETER") {
    return contact.createdBy === actor.id || sharedAdviserIds.includes(contact.createdBy);
  }
  return false;
}

export function canDeleteContact(actor: Actor): boolean {
  return actor.role === "MASTER";
}
