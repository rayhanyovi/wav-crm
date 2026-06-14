import type { Actor } from "../../middleware/context.js";

/** Only MASTER can list or modify users. */
export function canManageUsers(actor: Actor): boolean {
  return actor.role === "MASTER";
}

/** Any authenticated user can view their own profile. */
export function canViewUser(actor: Actor, targetId: string): boolean {
  return actor.role === "MASTER" || actor.id === targetId;
}
