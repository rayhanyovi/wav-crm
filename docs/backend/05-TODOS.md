# 05 — Build Plan & TODOs

Checklist for AI agents. The backend lives in `server/` inside `wav-crm-nextjs`
(single repo — see `07-DEPLOYMENT.md`). Each module follows the **leads slice**
pattern (`server/modules/leads/*`). Definition of done for every endpoint: zod
validation + app-layer authz + transactional side-effects + error handling +
tests (authz pure, sideEffects pure, service mocked-prisma, route integration).
Don't merge a module without `npm run test:server` green and
`npm run typecheck:server` clean.

## Phase 0 — Foundation ✅ (done in this scaffold)
- [x] Single-repo wiring: `server/` + `api/[...path].ts` + `prisma/` + `vercel.json`,
      merged into the frontend `package.json` (`dev:server`, `test:server`,
      `typecheck:server`, `prisma:*`, `postinstall`).
- [x] Project setup (TS/ESM, Express, Prisma, zod, pino, vitest).
- [x] `config/env.ts` fail-fast validation.
- [x] Error model (`lib/errors.ts`) + central `errorHandler` + `notFoundHandler`.
- [x] `requireAuth` (Supabase JWT verify → `req.actor`) + `requireRole`.
- [x] `validate` middleware, `asyncHandler`, request-id, CORS.
- [x] Health/readiness routes.
- [x] **Leads vertical slice** (CRUD + authz + status side-effects) + tests.

## Phase 1 — Schema & wiring ✅ (done 2026-06-14)
- [x] Introspected live DB; full `schema.prisma` (22 tables + all enums) written
      manually from `information_schema` — all models with camelCase `@map` names.
- [x] `prisma generate`; leads slice types verified (47 tests green).
- [ ] Add a `seed`/fixtures path for integration tests (optional test DB).

## Phase 2 — Leads completed ✅ (done 2026-06-14)
- [x] `POST /leads/:id/claim` — ADVISER claims APPOINTMENT lead (−1 credit, 409 on
      0-balance, 409 on already-claimed, idempotent if actor owns it).
- [x] `POST /leads/:id/return` — returns lead to pool (+1 credit refund; MASTER
      can return any).
- [x] `POST /leads/:id/convert` — creates contact + deal atomically (fact-find
      carry-over, adviser auto-assigns when actor is ADVISER).
- [x] `POST /leads/claim-for-call` — batch pool claim (NA + expired COOLDOWN,
      no credits consumed).
- [x] `GET /leads/:id/notes`, `POST /leads/:id/notes` — lead notes CRUD.
- [x] `GET /leads/:id/status-history` — full status trail.
- [x] Tests: 20 Phase-2 cases covering authz-deny, 0-credit, idempotency,
      already-claimed, concurrent-claim guard, empty pool, fact-find carry-over.

## Phase 3 — Deals
- [ ] Deals CRUD with the **ownership-correct** authz (the `42501` fix:
      stage/mark-lost requires MASTER or assigned owner; released deals must be
      claimed first).
- [ ] `POST /deals/:id/stage` → `stage_history` + notifications.
- [ ] `claim` / `release_deal`.
- [ ] Proposals + proposal lines.

## Phase 4 — Contacts, Activities, Notifications, Comments
- [ ] Contacts CRUD + notes (+ conversion link from leads).
- [ ] Activities CRUD with filters (lead/deal/contact/type/scheduled); calendar
      query (`scheduled_at` not null, including FOLLOW_UP).
- [ ] Notifications list + mark-read/read-all.
- [ ] Comments by entity.
- [ ] Call sessions telemetry endpoint.

## Phase 5 — Catalog & admin
- [ ] Products / bundles read endpoints.
- [ ] SGA funds list (paginated/searchable).
- [ ] Users/team: `GET /users`, `PATCH /users/:id` (MASTER: role/credit/access).
- [ ] Onboarding + approve/reject + activate-super-admin (port the user RPCs).
- [ ] Audit log read endpoint (MASTER).

## Phase 6 — Frontend cutover (in `wav-crm-nextjs`)
- [ ] Add `src/lib/api.ts` typed client (bearer token, envelope unwrap, error → toast).
- [ ] Re-point `src/services/leads.ts` at the API; keep a Supabase fallback flag.
- [ ] Migrate remaining services one at a time; delete dead Supabase data calls.
- [ ] Resolve the `telemarketer_access` vs `leads_access` discrepancy on both sides.

## Phase 7 — Hardening (cross-cutting)
- [ ] Rate limiting + security headers (helmet) + body-size limits.
- [ ] `pino-http` request logging with the correlation id.
- [ ] Centralized pagination/sorting helper.
- [ ] OpenAPI spec generated from the zod schemas.
- [ ] CI: typecheck + test + (optional) integration tests against a throwaway DB.
- [ ] Decide Phase 2 auth (own JWT issuance) and implement the new `TokenVerifier`.

## Phase 8 — Vercel deploy (single project)
- [ ] Set env vars in Vercel (pooled `DATABASE_URL`, `DIRECT_URL`,
      `SUPABASE_JWT_SECRET`, `CORS_ORIGINS`; `VITE_*` for the client). **No
      backend secret may carry a `VITE_` prefix.**
- [ ] Confirm the `api/[...path].ts` function bundles the Prisma client
      (`postinstall`/`prisma generate` runs in the build).
- [ ] Smoke-test `GET /api/leads` and a 401 (no token) against the deployment.
- [ ] Verify the SPA rewrite doesn't shadow `/api/*`.
- [ ] Keep `server/index.ts` (app.listen) working as the self-host escape hatch.

## Cross-cutting rules (apply to every task)
- Never read `process.env` outside `config/env.ts`.
- Never trust client-supplied `created_by`/owner fields — derive from `actor`.
- Every mutating method: transaction + audit log + relevant notifications.
- Every endpoint: at least one authz-deny test and one validation-fail test.
- Keep the ported SQL in a comment header next to its app-layer port.
