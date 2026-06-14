# 01 — Architecture

## Goals

1. **One swappable boundary.** The frontend calls `https://api/...`; what's
   behind it (Supabase, self-hosted Postgres, another host) is a backend concern.
2. **Portability.** Business logic and side-effects live in app code, not in the
   database, so the DB can be moved without losing behavior.
3. **Safety.** Authorization, validation, and error handling are mandatory and
   uniform across every endpoint.

## Stack

- **Runtime:** Node ≥ 20, TypeScript (ESM), Express 4.
- **ORM:** Prisma (introspected from the live Postgres — see §Schema).
- **Validation:** zod (every request body/query/param).
- **Auth:** Supabase JWT verification in Phase 1 (pluggable — see §Auth).
- **Logging:** pino (+ pino-http when added), correlation id per request.
- **Tests:** vitest + supertest; Prisma mocked (no DB needed for unit/route tests).

## Where the code lives

The backend is **inside `wav-crm-nextjs`** (single repo, single `package.json`)
under `server/`, with `api/[...path].ts` as the Vercel entrypoint and `prisma/`
at the repo root. Frontend stays in `src/`. See `07-DEPLOYMENT.md` for the full
layout and the two-entrypoints model (Vercel function vs `app.listen`).

## Layered request flow (all paths under `server/`)

```
server/app.ts         app factory (cors, json, request-id, route mounting, error mw)
server/index.ts       self-host bootstrap (app.listen), graceful shutdown, guards
api/[...path].ts      Vercel entrypoint — export default createApp()

middleware/
  auth.ts             requireAuth(): verify token → resolve crm_user → req.actor
  authorize.ts        requireRole(minRole) coarse guard + hasRole/isMaster helpers
  validate.ts         validate({body,query,params}) with zod, coerces + 422s
  errorHandler.ts     central error → JSON envelope; notFoundHandler for 404s
  context.ts          Actor type + Express.Request augmentation

modules/<name>/
  *.routes.ts         router = requireAuth + validate + asyncHandler(controller)
  *.controller.ts     thin: getActor(req) + call service + shape response
  *.service.ts        AUTHZ + Prisma transaction + SIDE-EFFECTS (the real work)
  *.schema.ts         zod DTOs
  *.authz.ts          app-layer port of this table's RLS policies
  *.sideEffects.ts    app-layer port of this table's triggers/RPCs

lib/
  prisma.ts           shared PrismaClient (BYPASSES RLS — see authz note)
  errors.ts           AppError hierarchy (status + code + details + expose)
  asyncHandler.ts     forwards async errors to Express
  logger.ts           pino
config/env.ts         zod-validated environment, fail-fast at boot
```

**Why this split:** controllers stay dumb and uniform; all authorization and
side-effects are in the service/authz/sideEffects trio, which is exactly the
surface that needs review and tests. Adding a module = copy the leads folder.

## Auth (Phase 1 → later)

- **Phase 1 (now):** Frontend keeps logging into Supabase. It sends the Supabase
  access token as `Authorization: Bearer <jwt>`. `requireAuth` verifies it
  locally (HS256 with `SUPABASE_JWT_SECRET`), extracts `sub` (auth user id),
  loads the matching `crm_users` row, and attaches `req.actor`. No frontend auth
  rewrite required.
- **Verifier is pluggable.** `TokenVerifier` in `middleware/auth.ts` is an
  interface. To leave Supabase later, implement a new verifier (e.g. verify a
  self-issued JWT, or call an external IdP) and swap it — nothing else changes.
- **Inactive/role-less accounts are rejected** at the middleware (mirrors the
  `is_active`/`account_status` checks the frontend auth store does).

## Authorization (replaces RLS)

The backend connects with a privileged DB role, so **RLS is bypassed**. Each
table's RLS policy is re-expressed as pure functions in `*.authz.ts`, called by
the service before any read/write. See `03-AUTHZ-MATRIX.md` for the full mapping
and `modules/leads/leads.authz.ts` for the reference.

Two layers:
- **Coarse:** `requireRole(minRole)` route guard for blanket role gates.
- **Row-level:** `can<Action>(actor, row)` in the service, after loading the row
  (needed for ownership checks like "assigned to me").

## Side-effects (replaces triggers)

Every trigger becomes an explicit step inside the service's Prisma
`$transaction`, so a write and its consequences (status history, notifications,
audit log, credit ledger) commit atomically. Pure builders (e.g.
`buildLeadNotifications(prev, next)`) are unit-tested without a DB; the
`emit*`/`record*`/`writeAuditLog` helpers do the I/O. See `04-SIDE-EFFECTS.md`.

## Error model

Single JSON envelope for every error:

```json
{ "error": { "code": "NOT_FOUND", "message": "Lead not found", "details": [...], "requestId": "..." } }
```

- Deliberate errors are `AppError` subclasses (status + stable `code`).
- Zod → 422 `VALIDATION` with per-field `details`.
- Prisma `P2025`→404, `P2002`→409, etc.
- Anything else → 500 `INTERNAL` with the message **hidden in production**.
- Controllers never try/catch; they throw and let `asyncHandler` + the central
  `errorHandler` do the rest.

## Schema (source of truth)

The live Postgres is canonical. Generate the schema by introspection:

```bash
npm run prisma:pull && npm run prisma:generate
```

`prisma/schema.prisma` currently contains only the 5 models the leads slice
needs (so it compiles + tests run offline). `db pull` will expand it to all 22
tables. Keep Prisma field names camelCase with `@map` to the snake_case columns
(as the slice does).

## Frontend migration strategy (incremental, low-risk)

1. Introduce a typed API client in the frontend (`src/lib/api.ts`) — one place
   that does `fetch` with the bearer token and unwraps the envelope.
2. Re-point **one service module at a time** (`src/services/leads.ts` first,
   matching this backend's first slice) from `supabase.from(...)` to the API
   client. Hooks/components don't change.
3. Keep a feature flag / env switch so a module can fall back to direct Supabase
   during rollout.
4. When all services are migrated, the frontend no longer needs the Supabase
   data client (it may still use Supabase Auth until Phase 2).

## Config

All env via `config/env.ts` (zod, fail-fast). See `.env.example`. Never read
`process.env` directly elsewhere.
