import type { Actor } from "../../middleware/context.js";

/** Anyone who can work leads can save a call session. */
export function canCreateCallSession(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "TELEMARKETER" || actor.role === "ADVISER";
}
