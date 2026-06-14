import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { ForbiddenError, UnauthenticatedError } from "../lib/errors.js";
import type { Actor, CrmRole } from "./context.js";

const VALID_ROLES: ReadonlySet<string> = new Set(["MASTER", "ADVISER", "TELEMARKETER"]);

/**
 * Pluggable token verification. Phase 1 verifies the Supabase HS256 access
 * token locally. To move off Supabase later, swap this implementation (e.g. a
 * self-issued JWT verifier) without touching the rest of the codebase.
 */
export interface TokenVerifier {
  /** Returns the auth user id (`sub`) or throws UnauthenticatedError. */
  verify(token: string): { authUserId: string; email?: string };
}

export const supabaseJwtVerifier: TokenVerifier = {
  verify(token) {
    try {
      const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET, {
        audience: env.SUPABASE_JWT_AUD,
        algorithms: ["HS256"],
      });
      if (typeof payload === "string" || !payload.sub) {
        throw new UnauthenticatedError("Malformed access token");
      }
      return { authUserId: String(payload.sub), email: (payload as jwt.JwtPayload).email as string | undefined };
    } catch (err) {
      if (err instanceof UnauthenticatedError) throw err;
      throw new UnauthenticatedError("Invalid or expired access token");
    }
  },
};

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

/**
 * Authenticates the request: verifies the bearer token, resolves the matching
 * crm_users row, and attaches it as `req.actor`. Rejects inactive accounts.
 */
export function requireAuth(verifier: TokenVerifier = supabaseJwtVerifier): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = bearerToken(req.headers.authorization);
      if (!token) throw new UnauthenticatedError("Missing bearer token");

      const { authUserId } = verifier.verify(token);

      const user = await prisma.crmUser.findFirst({ where: { authUserId } });
      if (!user) throw new UnauthenticatedError("No CRM profile for this account");
      if (!user.isActive || user.accountStatus !== "ACTIVE") {
        throw new ForbiddenError("Account is not active");
      }
      if (!user.role || !VALID_ROLES.has(user.role)) {
        throw new ForbiddenError("Account has no assigned role");
      }

      const actor: Actor = {
        id: user.id,
        authUserId,
        email: user.email,
        role: user.role as CrmRole,
        isActive: user.isActive,
        creditBalance: user.creditBalance,
        telemarketerAccess: user.telemarketerAccess,
        telemarketerId: user.telemarketerId,
        leadsAccess: user.leadsAccess,
      };
      req.actor = actor;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Reads `req.actor`, throwing if `requireAuth` wasn't run first. */
export function getActor(req: { actor?: Actor }): Actor {
  if (!req.actor) throw new UnauthenticatedError();
  return req.actor;
}
