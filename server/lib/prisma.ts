import { PrismaClient } from "../../prisma/generated/client/index.js";
import { isProd } from "../config/env.js";

/**
 * Single shared PrismaClient. The backend connects with a privileged role and
 * therefore BYPASSES Postgres RLS — every access rule that used to live in RLS
 * now MUST be enforced in the app layer (see each module's authz.ts and
 * docs/backend/03-AUTHZ-MATRIX.md). This is the single most important security
 * note in the whole backend.
 *
 * Serverless note (Vercel): cache the client on `globalThis` so warm
 * invocations and dev/HMR reuse one client instead of opening new Postgres
 * connections each time. In prod point `DATABASE_URL` at the POOLED connection
 * (Supabase pgBouncer, port 6543, `?pgbouncer=true`); use `DIRECT_URL` only for
 * `prisma db pull` / migrations.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function ensureSupabasePoolerUrlIsPrismaSafe(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) return;

  try {
    const url = new URL(raw);
    const isSupabaseTransactionPooler =
      url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543";

    if (!isSupabaseTransactionPooler) return;

    let changed = false;
    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
      changed = true;
    }
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
      changed = true;
    }

    if (changed) process.env.DATABASE_URL = url.toString();
  } catch {
    // env.ts already validates that DATABASE_URL is present. Leave unusual DSNs as-is.
  }
}

ensureSupabasePoolerUrlIsPrismaSafe();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ["warn", "error"] : ["query", "warn", "error"],
  });

if (!isProd) globalForPrisma.prisma = prisma;

/** A Prisma transaction client — the type passed to `prisma.$transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
