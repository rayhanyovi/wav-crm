import type { Actor } from "../../middleware/context.js";

/** Only MASTER can modify users. */
export function canManageUsers(actor: Actor): boolean {
  return actor.role === "MASTER";
}

/** User names/roles are shared in the CRM UI for assignment and attribution. */
export function canListUsers(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER" || actor.role === "TELEMARKETER";
}

/** Any authenticated user can view their own profile. */
export function canViewUser(actor: Actor, targetId: string): boolean {
  return actor.role === "MASTER" || actor.id === targetId;
}
