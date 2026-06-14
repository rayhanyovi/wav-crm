# WAV CRM — Agent Handoff Document

> Point this file at any AI agent to pick up where development left off.
> Last updated: 2026-06-14

---

## 1. What This Project Is

**WAV CRM** (`wav-crm-nextjs`) is a single-repo that serves both a React frontend
and an Express REST backend. It is the **Dealflow** module of the WAV wealth-advisory
platform — a pipeline CRM used by Singapore-based telemarketers and financial advisers
to move leads from cold calls to closed deals.

**Repo path (local):** `/home/rayhanyovi/Documents/Projects/Projectsz/wav/wav-crm-nextjs`

---

## 2. Infrastructure

| Service | Detail |
|---------|--------|
| **Database** | Supabase PostgreSQL, project ID `auyynqzrhwsxbtukrbri` (ap-northeast-1) |
| **Vercel** | Team `WAV Tech's projects` (`team_dTEVW2vrOeUxs1G2WPOJdPAY`), project `wav-crm` (`prj_XPFlpZX8ViVnCjj3cshpuHXCQYJA`) |
| **Frontend URL** | Deployed via Vercel; dev server: `http://localhost:5173` |
| **Backend URL** | `http://localhost:4000` (dev) / `/api/*` (Vercel, same domain as frontend) |

### Key env files

| File | Purpose |
|------|---------|
| `.env.local` | Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `.env.server` | Backend (create from `.env.server.example`): `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_JWT_SECRET` |

---

## 3. Repo Layout

```
wav-crm-nextjs/
├── src/                        ← React frontend (Vite + React 19 + Tailwind v4)
│   ├── pages/                  ← Route-level page components
│   ├── components/             ← Reusable UI components
│   ├── hooks/                  ← TanStack Query hooks (server state)
│   ├── services/               ← Supabase JS data layer (to be migrated to API)
│   ├── store/                  ← Zustand stores (auth, layout, toasts, call session)
│   ├── lib/                    ← Utilities, permissions, supabase client
│   └── data/types.ts           ← Shared TS types (Lead, Deal, User, etc.)
│
├── server/                     ← Express backend (Node + TypeScript ESM)
│   ├── app.ts                  ← App factory (CORS, JSON, routes, error handlers)
│   ├── index.ts                ← Self-host bootstrap (app.listen)
│   ├── config/env.ts           ← Zod-validated env (fail-fast at boot)
│   ├── lib/
│   │   ├── prisma.ts           ← Shared PrismaClient singleton (bypasses RLS)
│   │   ├── errors.ts           ← AppError hierarchy (status + code)
│   │   ├── asyncHandler.ts     ← Wraps async controllers for Express
│   │   └── logger.ts           ← Pino logger
│   ├── middleware/
│   │   ├── auth.ts             ← requireAuth(): Supabase JWT → req.actor
│   │   ├── authorize.ts        ← requireRole() coarse guard
│   │   ├── validate.ts         ← Zod validation middleware (body/query/params)
│   │   ├── errorHandler.ts     ← Central JSON error envelope
│   │   └── context.ts          ← Actor type + Express.Request augmentation
│   └── modules/
│       ├── health/             ← GET /health, GET /ready
│       └── leads/              ← ✅ COMPLETE — use as the reference pattern
│           ├── leads.routes.ts
│           ├── leads.controller.ts
│           ├── leads.service.ts
│           ├── leads.schema.ts
│           ├── leads.authz.ts
│           ├── leads.sideEffects.ts
│           ├── leads.authz.test.ts
│           ├── leads.service.test.ts
│           ├── leads.sideEffects.test.ts
│           └── leads.phase2.test.ts
│
├── prisma/
│   └── schema.prisma           ← Full schema (22 models, 12 enums), introspected 2026-06-14
│
├── api/
│   └── [...path].ts            ← Vercel serverless entrypoint
│
├── vercel.json                 ← Rewrites: /api/* → function, everything else → SPA
│
├── docs/backend/
│   ├── 00-AUDIT.md             ← Original audit of what needed to be built
│   ├── 01-ARCHITECTURE.md      ← Full architecture overview (READ THIS FIRST)
│   ├── 02-API-SPEC.md          ← API contract spec
│   ├── 03-AUTHZ-MATRIX.md      ← All RLS policies mapped to app-layer authz
│   ├── 04-SIDE-EFFECTS.md      ← All DB triggers mapped to app-layer side-effects
│   ├── 05-TODOS.md             ← Phase checklist (the source of truth for what's left)
│   ├── 06-TESTING.md           ← Test strategy
│   └── 07-DEPLOYMENT.md        ← Vercel deployment guide
│
└── package.json                ← Scripts: dev, dev:server, test, test:server, typecheck:server
```

---

## 4. NPM Scripts

```bash
npm run dev              # Vite dev server (frontend, port 5173)
npm run dev:server       # Express dev server (backend, port 4000, tsx watch)
npm run test:server      # Vitest — server tests only (NO DB needed, Prisma is mocked)
npm run typecheck:server # tsc --noEmit for server/
npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:pull      # Introspect live DB → overwrite schema.prisma
npm run build            # Production build (frontend only, for Vercel)
```

---

## 5. The Module Pattern (copy from `leads/`)

Every module has exactly these 6 files. Adding a module = copy the leads folder, rename, adapt.

```
*.routes.ts       Router: requireAuth + validate + asyncHandler(controller fn)
*.controller.ts   Thin: getActor(req) → call service → res.json / res.status(201)
*.service.ts      All real logic: AUTHZ check → prisma.$transaction → side-effects
*.schema.ts       Zod DTOs (idParamSchema, listQuerySchema, createSchema, updateSchema, ...)
*.authz.ts        Pure functions: canList, canView, canCreate, canUpdate, canDelete, canXxx
*.sideEffects.ts  Pure builders + I/O helpers for status history, notifications, audit log
```

**Rules (from `docs/backend/05-TODOS.md`):**
- Never read `process.env` outside `config/env.ts`
- Never trust client-supplied `created_by`/owner fields — always derive from `req.actor`
- Every mutation: `prisma.$transaction` + audit log + relevant notifications
- Every endpoint needs: ≥1 authz-deny test + ≥1 validation-fail test
- Gate for merge: `npm run test:server` green + `npm run typecheck:server` clean

**Register the new router in `server/app.ts`:**
```typescript
import { dealsRouter } from "./modules/deals/deals.routes.js";
// ...
app.use("/api/deals", dealsRouter);
```

---

## 6. Current Status

### Test count: **47 / 47 passing** (as of 2026-06-14)

### Phase checklist

| Phase | What | Status |
|-------|------|--------|
| 0 | Foundation: Express, Prisma, auth middleware, health routes, leads CRUD | ✅ Done |
| 1 | Full Prisma schema (22 models introspected from live DB) | ✅ Done |
| 2 | Leads phase-2: claim, return, convert, claim-for-call, notes, status-history | ✅ Done |
| 3 | **Deals CRUD + stage + claim/release + proposals** | ⬜ **START HERE** |
| 4 | Contacts, Activities, Notifications, Comments | ⬜ |
| 5 | Catalog & admin (products, funds, users, audit logs) | ⬜ |
| 6 | Frontend cutover (swap Supabase JS → API client, one service at a time) | ⬜ |
| 7 | Hardening (helmet, rate limiting, OpenAPI, CI) | ⬜ |
| 8 | Vercel deploy (env vars, smoke test) | ⬜ |

---

## 7. Phase 3 — Deals (next task)

Create `server/modules/deals/` with these 6 files following the leads pattern.

### Endpoints to implement

| Method | Path | Who | What |
|--------|------|-----|------|
| `GET` | `/api/deals` | MASTER/ADVISER/TM | List deals (MASTER=all, ADVISER=own+open pool, TM=linked deals) |
| `POST` | `/api/deals` | MASTER/ADVISER | Create deal directly (adviser adding a new client/family member) |
| `GET` | `/api/deals/:id` | MASTER/ADVISER/TM | Get single deal |
| `PATCH` | `/api/deals/:id` | MASTER or assigned ADVISER | Update deal fields (fact-find, title, value, etc.) |
| `DELETE` | `/api/deals/:id` | MASTER only | Soft delete |
| `POST` | `/api/deals/:id/stage` | MASTER or assigned ADVISER | Move to next stage (→ stage_history + notifications) |
| `POST` | `/api/deals/:id/claim` | ADVISER with credit | Claim unassigned APPOINTMENT deal (−1 credit) |
| `POST` | `/api/deals/:id/release` | MASTER or assigned ADVISER | Release deal back to pool (+1 credit) |
| `GET` | `/api/deals/:id/proposals` | MASTER/ADVISER | List proposals for a deal |
| `POST` | `/api/deals/:id/proposals` | MASTER or assigned ADVISER | Create proposal |
| `PATCH` | `/api/deals/:id/proposals/:proposalId` | MASTER or assigned ADVISER | Update proposal (status, name, notes) |
| `POST` | `/api/deals/:id/proposals/:proposalId/lines` | MASTER or assigned ADVISER | Add fund line to proposal |
| `DELETE` | `/api/deals/:id/proposals/:proposalId/lines/:lineId` | MASTER or assigned ADVISER | Remove fund line |

### Authz rules for deals

```typescript
// List: MASTER sees all; ADVISER sees assigned OR (stage=APPOINTMENT AND assignedToId=null);
//       TELEMARKETER sees deals where telemarketer_id = actor.id
function canListDeals(actor: Actor): boolean { return true; } // everyone can list (filter in query)

function canViewDeal(actor: Actor, deal: Deal): boolean {
  if (actor.role === "MASTER") return true;
  if (actor.role === "ADVISER") return deal.assignedToId === actor.id || deal.assignedToId === null;
  if (actor.role === "TELEMARKETER") return deal.telemarketerId === actor.id;
  return false;
}

function canMutateDeal(actor: Actor, deal: Deal): boolean {
  if (actor.role === "MASTER") return true;
  return actor.role === "ADVISER" && deal.assignedToId === actor.id;
}

function canClaimDeal(actor: Actor): boolean {
  return actor.role === "MASTER" || actor.role === "ADVISER";
}
```

### Stage transition rules

```
APPOINTMENT → PROPOSAL       (meeting held, moving to proposal phase)
PROPOSAL    → SUBMITTED      (application sent — requires insurer + insurer_ref)
SUBMITTED   → WON            (closed — requires policy_number; sets closed_at)
ANY         → LOST           (with required lost_reason; sets closed_at)
```

Side-effects on stage change:
- Write a `stage_history` row (`from_stage`, `to_stage`, `changed_by`)
- Send a notification to `assigned_to_id` (if set)
- On WON: set `closed_at = now()`
- On LOST: set `closed_at = now()`, set `lost_reason`

### Claim/Release rules (mirrors lead claim/return)

- **Claim**: ADVISER must have `credit_balance > 0`; deal must be `stage=APPOINTMENT` and `assignedToId=null`
  - Sets `assignedToId = actor.id`, decrements `crm_users.credit_balance`, writes `credit_transactions` (action=CLAIM)
- **Release**: MASTER or deal owner; refunds +1 credit to whoever owned it, sets `assignedToId = null`
  - Writes `credit_transactions` (action=RETURN)

### The `42501` fix (context)

In the frontend, attempts to call `mark as lost` or advance deal stage returned a Postgres `42501` (RLS denial) error because the frontend was calling Supabase directly and the user's RLS policy only allowed the assigned adviser to mutate. The backend bypasses RLS but enforces the same ownership rule in `canMutateDeal`. This is the fix.

### DB models involved (from `prisma/schema.prisma`)

```prisma
model Deal {
  id, title, value, stage (DealStage enum), leadId?, contactId,
  telemarketerId?, assignedToId?, expectedCloseDate?, lostReason?,
  closedAt?, insurer?, insurerRef?, submittedAt?, policyNumber?,
  financialGoal?, riskTolerance?, investmentHorizon?, monthlyInvestable?,
  existingInvestments?, factFindNotes?, factFindDone, createdBy,
  createdAt, updatedAt, deletedAt?
  → relations: lead?, contact, stageHistory[], proposals[], activities[]
}

model StageHistory { id, dealId, fromStage?, toStage, changedBy, note?, createdAt }
model DealProposal { id, dealId, name, status (DealProposalStatus), totalValue, notes?, createdBy, createdAt, updatedAt; → lines[] }
model DealProposalLine { id, proposalId, fundIsin, fundName, riskRating, allocationPct }
```

### Enums

```typescript
DealStage: CALLING | APPOINTMENT | PROPOSAL | SUBMITTED | WON | LOST
DealProposalStatus: DRAFT | PRESENTED | ACCEPTED | REJECTED
```

---

## 8. Phases 4–8 Summary (for planning)

### Phase 4 — Contacts, Activities, Notifications, Comments

- **Contacts**: CRUD + notes. Source = converted leads (`convertedContactId`). Authz: MASTER/ADVISER.
- **Activities**: CRUD with filters (`lead_id`, `deal_id`, `contact_id`, `type`, `scheduled_at`). Calendar query = `scheduled_at IS NOT NULL` including `FOLLOW_UP` type.
- **Notifications**: `GET /notifications` (own only), `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`.
- **Comments**: `GET /activities/:id/comments`, `POST /activities/:id/comments`.
- **Call sessions**: `POST /call-sessions` (save completed session telemetry).

### Phase 5 — Catalog & Admin

- `GET /funds` — paginated SGA funds list (`sga_funds` table, search by `fund_name`/`isin`)
- `GET /products`, `GET /bundles` — read-only catalog
- `GET /users`, `PATCH /users/:id` — MASTER only; update role/credit/leads_access/telemarketer config
- `GET /audit-logs` — MASTER only, paginated

### Phase 6 — Frontend Cutover

1. Create `src/lib/api.ts` — typed fetch client that attaches the Supabase bearer token and unwraps the `{ data: ... }` / `{ error: ... }` envelope.
2. Re-point `src/services/leads.ts` at `/api/leads` instead of `supabase.from("leads")`.
3. Migrate one service at a time: leads → deals → contacts → activities → users.
4. Delete dead Supabase data-layer calls (keep Supabase Auth).

### Phase 7 — Hardening

- `helmet()` — security headers
- `express-rate-limit` — global + per-endpoint limits
- `pino-http` — structured request logging with correlation id
- OpenAPI spec generated from zod schemas (or hand-written)
- CI: typecheck + test on every PR

### Phase 8 — Vercel Deploy

Set these env vars in Vercel project settings (`wav-crm`):

| Var | Where |
|-----|-------|
| `DATABASE_URL` | Supabase pooled connection (PgBouncer port 6543) |
| `DIRECT_URL` | Supabase direct connection (port 5432) |
| `SUPABASE_JWT_SECRET` | Supabase dashboard → Settings → API → JWT Secret |
| `SUPABASE_JWT_AUD` | `authenticated` |
| `CORS_ORIGINS` | The Vercel frontend URL (e.g. `https://wav-crm.vercel.app`) |
| `VITE_SUPABASE_URL` | Already set (frontend) |
| `VITE_SUPABASE_ANON_KEY` | Already set (frontend) |

Confirm:
- `npm run build` works (Vite builds `dist/`)
- `api/[...path].ts` bundles correctly (Prisma `postinstall` runs `prisma generate`)
- `GET /api/health` returns 200 on the deployed URL
- SPA rewrite (`/((?!api/).*)` → `/index.html`) doesn't shadow `/api/*`

---

## 9. Key Business Rules (for authz correctness)

### Roles
- `MASTER` — full access to everything
- `ADVISER` — owns deals; can see leads only if `telemarketer_access = true`
- `TELEMARKETER` — works the leads pool; sees only deals linked to their leads

### The 4 Personas
| | Role | Can work leads? | Can own deals? |
|---|---|---|---|
| A — Pure TM | TELEMARKETER | ✅ | ❌ |
| B — Pure Adviser | ADVISER | ❌ (unless `telemarketer_access=true`) | ✅ |
| C — Adviser who TMs | ADVISER + `telemarketer_access=true` | ✅ | ✅ |
| D — TM with dealing access | TELEMARKETER | ✅ | sees granting adviser's deals |

### Credit system
- `credit_balance` on `crm_users`
- Claiming an APPOINTMENT lead or deal costs 1 credit (−1, write `credit_transactions` with `action=CLAIM`)
- Releasing/returning refunds 1 credit (+1, write `credit_transactions` with `action=RETURN`)
- Admin assigns credits manually (`action=ADMIN_ASSIGN`)

### Lead → Deal flow
1. TM calls lead → status changes (`NA`, `KIV`, `COOLDOWN`, `NOT_INTERESTED`, `AVOID`, `OTHERS`)
2. TM books appointment → `POST /leads/:id/convert` → creates Contact + Deal atomically
3. Deal starts at `stage=APPOINTMENT`, `assignedToId=null` (unless actor is ADVISER)
4. Adviser claims deal → `POST /deals/:id/claim` (costs 1 credit)
5. Adviser advances: APPOINTMENT → PROPOSAL → SUBMITTED → WON (or LOST)

---

## 10. DB Seed Data (crm_users)

| id | name | role | credit_balance |
|----|------|------|---------------|
| user-1 | WAV Master | MASTER | 0 |
| user-2 | Junhao | ADVISER | 3 |
| user-3 | Javier | ADVISER | 5 |
| user-4 | Yinesa | TELEMARKETER | 0 |
| user-5 | Zee | TELEMARKETER | 0 |

---

## 11. Quick Verification

```bash
# From wav-crm-nextjs/
npm run test:server       # Should be 47/47 green
npm run typecheck:server  # Should be 0 errors
npm run dev:server        # Starts on port 4000 (needs .env.server)
curl http://localhost:4000/health  # {"status":"ok"}
```

---

## 12. Where to Find More Context

| Doc | What's in it |
|-----|-------------|
| `docs/backend/01-ARCHITECTURE.md` | Full architecture, auth flow, layering |
| `docs/backend/02-API-SPEC.md` | API contract (request/response shapes) |
| `docs/backend/03-AUTHZ-MATRIX.md` | All RLS → app-layer authz mappings |
| `docs/backend/04-SIDE-EFFECTS.md` | All DB triggers → app-layer side-effects |
| `docs/backend/05-TODOS.md` | Phase checklist (the canonical TODO list) |
| `docs/DEALFLOW_GUIDE.md` | Product guide — personas, flows, demo script |
| `server/modules/leads/` | The complete reference implementation |
| `prisma/schema.prisma` | Full DB schema (22 models) |
