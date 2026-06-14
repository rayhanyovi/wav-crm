import type { Actor } from "../../middleware/context.js";

/** All authenticated users can browse the catalog. */
export function canViewCatalog(_actor: Actor): boolean {
  return true;
}
