import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { createPublicKey, type JsonWebKey, type KeyObject } from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { ForbiddenError, UnauthenticatedError } from "../lib/errors.js";
import type { Actor, CrmRole } from "./context.js";

const VALID_ROLES: ReadonlySet<string> = new Set(["MASTER", "ADVISER", "TELEMARKETER"]);

/**
 * Pluggable token verification. Supports Supabase's legacy HS256 project secret
 * tokens and newer asymmetric ES256 access tokens exposed through JWKS.
 */
export interface TokenVerifier {
  /** Returns the auth user id (`sub`) or throws UnauthenticatedError. */
  verify(token: string): Promise<{ authUserId: string; email?: string }>;
}

interface Jwk {
  kid?: string;
  alg?: string;
  kty: string;
  use?: string;
  key_ops?: string[];
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
}

let jwksCache: { expiresAt: number; keys: Jwk[] } | null = null;

function getJwksUrl(): string | null {
  if (env.SUPABASE_JWKS_URL) return env.SUPABASE_JWKS_URL;
  const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`;
}

async function fetchJwks(): Promise<Jwk[]> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) return jwksCache.keys;

  const url = getJwksUrl();
  if (!url) throw new UnauthenticatedError("Supabase JWKS URL is not configured");

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new UnauthenticatedError("Unable to load Supabase signing keys");

  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  jwksCache = { keys, expiresAt: now + 10 * 60 * 1000 };
  return keys;
}

async function publicKeyForToken(token: string): Promise<KeyObject> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === "string") {
    throw new UnauthenticatedError("Malformed access token");
  }

  const { alg, kid } = decoded.header;
  const keys = await fetchJwks();
  const jwk = keys.find((key) => (!kid || key.kid === kid) && (!alg || !key.alg || key.alg === alg));
  if (!jwk) throw new UnauthenticatedError("Unknown access token signing key");

  return createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
}

export const supabaseJwtVerifier: TokenVerifier = {
  async verify(token) {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === "string") {
        throw new UnauthenticatedError("Malformed access token");
      }

      const alg = decoded.header.alg;
      const key =
        alg === "HS256"
          ? env.SUPABASE_JWT_SECRET
          : alg === "ES256"
            ? await publicKeyForToken(token)
            : null;

      if (!key) throw new UnauthenticatedError("Unsupported access token algorithm");

      const payload = jwt.verify(token, key, {
        audience: env.SUPABASE_JWT_AUD,
        algorithms: alg === "HS256" ? ["HS256"] : ["ES256"],
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

      const { authUserId } = await verifier.verify(token);

      const user = await prisma.crmUser.findFirst({ where: { authUserId } });
      if (!user) throw new UnauthenticatedError("No CRM profile for this account");
      if (!user.isActive || user.accountStatus !== "ACTIVE") {
        throw new ForbiddenError("Account is not active");
      }
      if (!user.role || !VALID_ROLES.has(user.role)) {
        throw new ForbiddenError("Account has no assigned role");
      }

      // A TM may be delegated dealing access by one or more advisers. Resolve
      // those advisers so authz can let the TM act on their deals/proposals.
      let delegatedAdviserIds: string[] = [];
      if (user.role === "TELEMARKETER") {
        const grantors = await prisma.crmUser.findMany({
          where: {
            role: "ADVISER",
            isActive: true,
            telemarketerAccess: true,
            telemarketerId: user.id,
          },
          select: { id: true },
        });
        delegatedAdviserIds = grantors.map((g) => g.id);
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
        delegatedAdviserIds,
      };
      req.actor = actor;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Lighter-weight auth for onboarding/bootstrap routes. Verifies the token and
 * resolves the matching crm_users row, but — unlike {@link requireAuth} — does
 * NOT require the account to be ACTIVE or to have a role yet. This lets a freshly
 * signed-up PENDING_PROFILE user call POST /api/users/onboarding (and a
 * pre-configured admin call /activate-super-admin) to progress through the
 * approval flow. The row itself must exist (created by the auth.users trigger).
 */
export function requireSession(verifier: TokenVerifier = supabaseJwtVerifier): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = bearerToken(req.headers.authorization);
      if (!token) throw new UnauthenticatedError("Missing bearer token");

      const { authUserId } = await verifier.verify(token);

      const user = await prisma.crmUser.findFirst({ where: { authUserId } });
      if (!user) throw new UnauthenticatedError("No CRM profile for this account");

      req.actor = {
        id: user.id,
        authUserId,
        email: user.email,
        // Role may be null/unassigned at this stage; onboarding routes don't read it.
        role: user.role as CrmRole,
        isActive: user.isActive,
        creditBalance: user.creditBalance,
        telemarketerAccess: user.telemarketerAccess,
        telemarketerId: user.telemarketerId,
        leadsAccess: user.leadsAccess,
        delegatedAdviserIds: [],
      };
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
