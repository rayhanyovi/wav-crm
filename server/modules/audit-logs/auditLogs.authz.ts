import type { Actor } from "../../middleware/context.js";

export function canViewAuditLogs(actor: Actor): boolean {
  return actor.role === "MASTER";
}
