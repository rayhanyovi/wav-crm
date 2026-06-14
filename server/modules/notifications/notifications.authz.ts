import type { Actor } from "../../middleware/context.js";

/** Everyone can access their own notifications. */
export function canAccessNotifications(_actor: Actor): boolean {
  return true;
}
