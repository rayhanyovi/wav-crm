import type { RequestHandler } from "express";
import { ForbiddenError } from "../lib/errors.js";
import type { Actor, CrmRole } from "./context.js";
import { getActor } from "./auth.js";

const ROLE_LEVEL: Record<CrmRole, number> = {
  TELEMARKETER: 0,
  ADVISER: 1,
  MASTER: 2,
};

/** Mirrors the frontend `can(user, minRole)` helper. */
export function hasRole(actor: Actor, minRole: CrmRole): boolean {
  return ROLE_LEVEL[actor.role] >= ROLE_LEVEL[minRole];
}

export function isMaster(actor: Actor): boolean {
  return actor.role === "MASTER";
}

/**
 * Route guard requiring at least `minRole`. Coarse-grained; row-level ownership
 * checks live in each module's `*.authz.ts` because they need the loaded record.
 */
export function requireRole(minRole: CrmRole): RequestHandler {
  return (req, _res, next) => {
    try {
      const actor = getActor(req);
      if (!hasRole(actor, minRole)) {
        throw new ForbiddenError(`Requires ${minRole} role or higher`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
