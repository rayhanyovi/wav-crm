# 06 — Testing Strategy

Goal: prove **authorization**, **validation**, **side-effects**, and **error
handling** for every endpoint — without needing a live database for the default
suite. `npm test` must stay fast and DB-free; an optional integration tier runs
against a throwaway Postgres.

## Tiers

| Tier | Tooling | DB? | What it proves |
|------|---------|-----|----------------|
| **Unit — authz** | vitest | no | Each RLS-derived rule allows/denies correctly. |
| **Unit — side-effects** | vitest | no | Pure builders (`buildLeadNotifications`, `deriveStatusColumns`) produce the right rows for each branch. |
| **Unit — service** | vitest + mocked Prisma | no | Authz is enforced, transaction steps fire (status history, audit, notifications), correct errors thrown. |
| **Integration — routes** | vitest + supertest, auth + service mocked | no | Routing, zod validation (422), error envelope + status mapping, 404s, request-id header. |
| **E2E — optional** | vitest + supertest + real Prisma | yes (throwaway) | Real queries, RLS-free writes behave, transactions commit/rollback. |

The reference slice covers the first four tiers — 27 tests in 4 files. Copy them.

## Required cases per module (the checklist)

For every resource, you must have:
- ✅ **Authz allow** for each permitted role/ownership combo.
- ✅ **Authz deny** for at least one forbidden combo (→ 403 `FORBIDDEN`).
- ✅ **Validation fail** for a bad body and a bad query (→ 422 `VALIDATION`).
- ✅ **Not found** path (→ 404 `NOT_FOUND`).
- ✅ **Side-effect fired** (status history / notification / audit / ledger) on
  the relevant mutation, plus a **negative** (e.g. no status history when status
  unchanged).
- ✅ **Unexpected error hidden** (a thrown `Error` → 500 with generic message,
  no internal detail leaked).

## How the mocked-Prisma service test works

`vi.hoisted` creates a fake `db` with the methods the service uses; `vi.mock`
replaces `lib/prisma.js` with it; `$transaction(cb)` is stubbed to run `cb(db)`
so transactional code executes synchronously against the mock. Assert on
`db.<model>.<method>.mock.calls`. See `modules/leads/leads.service.test.ts`.

## How the route test works

Mock `@/middleware/auth.js` to inject a fixed `actor` (skip real JWT), and mock
the service module to control outcomes. Then drive the app with supertest and
assert status + envelope. See `tests/app.routes.test.ts`.

## Commands

```bash
npm test          # full suite (DB-free)
npm run test:watch
npm run typecheck # tsc --noEmit — must be clean before merge
```

## Conventions

- One behavior per `it`. Name by behavior, not method.
- Test the **branch**, not the implementation detail — assert the persisted
  effect (a notification row of the right type), not the exact call shape where
  avoidable.
- Keep fixtures minimal; a `lead()/actor()` factory with overrides per file.
- Don't hit the network or a real DB in the default suite.
