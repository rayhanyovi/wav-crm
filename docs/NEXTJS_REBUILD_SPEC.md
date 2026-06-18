# WAV CRM — Next.js Rebuild Technical Specification

> **Purpose.** This is the authoritative *system-level* technical spec for rebuilding WAV CRM
> on Next.js. It describes **what the system is, how its data flows, what rules it must
> enforce, and how the code should be organized** — independent of visual design. UI/UX
> layout, spacing, copy, and interaction polish are intentionally **out of scope** and will be
> designed later. An implementing agent should treat the **Domain Layer (§6)**, **Business
> Rules (§7)**, and **Authorization Model (§8)** as hard contracts: they are ported 1:1 from
> the current production system and changing them changes behavior.
>
> **How to read this.** §1–§4 set context and stack. §5 is the target file layout. §6–§10 are
> the backend/core (the part that must not regress). §11–§15 are auth, data access, and the
> presentation architecture (atomic design + the two-menu shell you asked for). §16 walks
> concrete end-to-end flows. §17–§19 cover config, migration phasing, and open decisions.

---

## 1. System Overview

WAV CRM is an internal CRM for a telemarketing + financial-advisory business. Three roles
move a person from a cold phone number to a closed insurance/investment policy:

| Role | Level | Primary job |
|------|-------|-------------|
| **TELEMARKETER (TM)** | 0 | Works the cold-call pool; logs call outcomes; books appointments |
| **ADVISER** | 1 | Takes booked appointments; runs fact-find; builds fund proposals; closes deals |
| **MASTER** | 2 | Admin: approves users, assigns roles/credits, sees everything, can do anything a TM or Adviser can |

The spine of the product is a **two-stage funnel**:

```
        ┌─────────────── LEADS (telemarketing) ──────────────┐   ┌──────────── DEALS (advisory) ────────────┐
raw  →  NA → (claimed for call) → status updates → APPOINTMENT  →  contact+deal created → PROPOSAL → SUBMITTED → WON
phone                                    │                                                                    └→ LOST
                                         └→ NOT_INTERESTED / AVOID / KIV / OTHERS / COOLDOWN
```

Two scarce-resource mechanics gate the funnel:

1. **Cold-call pool** — unowned `NA`/expired-`COOLDOWN` leads are batch-claimed (soft-locked) into a calling session. No credit cost.
2. **Credit system** — an Adviser spends **1 credit** to claim an `APPOINTMENT` lead or an `APPOINTMENT`-stage deal, and is refunded **1 credit** on return/release. MASTER acts without spending credits.

Supporting subsystems: contacts, activities (calls/meetings/tasks/notes), a notification
feed, an immutable audit log, a fund/product catalog (incl. the SGA fund list), call-session
analytics, and call scripts.

---

## 2. Goals & Non-Goals

**Goals**
- Single deployable **Next.js fullstack app** on **Vercel Hobby**, backed by **Supabase Postgres**, with **no separate backend service** (removes the Express-on-serverless function-count pain that motivated this rebuild).
- **Clean architecture**: domain rules isolated from framework, infrastructure, and UI; each is independently testable.
- **Atomic-design** component system (atoms → molecules → organisms → templates → pages) on **Ant Design (antd)**.
- Preserve **every business rule and authorization decision** from the current system (§7, §8) exactly.
- A **two-menu shell**: a global **TopBar** and a primary **Sidebar**.

**Non-Goals (this document)**
- Visual design, theming specifics, exact copy, micro-interactions.
- New features beyond what exists today (call scripts is the newest; it stays).
- Re-modeling the database. The Prisma schema is reused as-is (§6).

---

## 3. Target Stack & Rationale

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | **Next.js (App Router)**, React 19, TypeScript | RSC + Server Actions collapse the API tier into the app; native to Vercel. |
| UI library | **Ant Design v5** (+ `@ant-design/nextjs-registry` for SSR styles) | Requested. Rich data-grid/form/table primitives suit a CRM. |
| Styling | antd theme tokens + CSS Modules for layout-only bits | Keep styling out of domain/app layers. |
| ORM | **Prisma** | Already the system's data layer; schema reused verbatim. |
| DB (prod) | **Supabase Postgres** via **Supavisor pooler** | Serverless needs pooled connections (see §12.4). |
| DB (dev) | **Postgres in Docker** | `DATABASE_URL`/`DIRECT_URL` swap per environment. |
| Auth | **Supabase Auth** via **`@supabase/ssr`** (cookie sessions) | Keeps existing users, passwords, reset flow, and the `crm_users` mapping. |
| Data fetching | **RSC reads + Server Actions writes** (primary); **Route Handlers** only for the narrow exceptions in §12.3 | Fewest serverless entrypoints; no bespoke API client; type-safe end to end. |
| Validation | **Zod** | Ported from current schemas; shared input contracts. |
| Server state on client | **TanStack Query** — only for client-polled data (notifications, calling session) | Most reads are RSC; Query is the exception, not the default. |
| Tables/forms | antd `Table`, `Form`, `Select`, `DatePicker` | Replaces the Radix/shadcn primitives. |
| Logging | `pino` (server) | Ported. |

> **Decision — data layer.** Given Vercel Hobby + Supabase free tier, **RSC + Server Actions
> is the most suitable model**: it keeps the function/entrypoint count low, removes the
> separate `/api` client+fetch boilerplate, and runs the authorization + transaction logic on
> the server next to Prisma. We keep a *small, explicit* set of Route Handlers only where a
> stable HTTP endpoint is genuinely required (§12.3).

---

## 4. Architecture Principles (Clean Architecture)

Four concentric layers; **dependencies point inward only**.

```
┌──────────────────────────────────────────────────────────────────┐
│ PRESENTATION  (app/, components/)                                  │
│   Next.js routes, RSC, Server Actions (thin), antd atomic UI       │
│        │ calls use-cases, never Prisma directly                    │
│ ┌──────▼───────────────────────────────────────────────────────┐  │
│ │ APPLICATION  (core/<module>/*.service.ts, *.authz.ts)         │  │
│ │   Use cases: orchestrate domain rules + repositories +        │  │
│ │   transactions + side-effects. Receives an `Actor`.           │  │
│ │ ┌────────▼─────────────────────────────────────────────────┐  │  │
│ │ │ DOMAIN  (core/<module>/*.rules.ts, core/shared)          │  │  │
│ │ │   Pure functions/invariants: stage machine, credit math, │  │  │
│ │ │   status derivations, notification builders. No I/O.     │  │  │
│ │ └──────────────────────────────────────────────────────────┘  │  │
│ └───────────────────────────────────────────────────────────────┘ │
│ INFRASTRUCTURE  (infra/)                                            │
│   Prisma client, Supabase clients, repository impls, logger        │
└──────────────────────────────────────────────────────────────────┘
```

**Rules of the road for the implementing agent**
- **Domain** functions are pure: given inputs, return outputs/decisions. They never touch Prisma, Supabase, or `Request`. (Today's `deriveStatusColumns`, `buildLeadNotifications`, the deal `VALID_TRANSITIONS` map, credit deltas all live here.)
- **Application** = use cases. Each is an `async function(actor, input)` that: checks authz → runs a Prisma transaction → applies domain rules → writes side-effects (history, notifications, audit) → returns a DTO. This is exactly today's `*.service.ts` shape and **must be preserved**.
- **Presentation** never imports Prisma. RSC and Server Actions call use cases only.
- **Infrastructure** is the only place that constructs the Prisma client and Supabase clients.

---

## 5. Target Directory Structure

```
wav-crm/
├── app/                                  # Next.js App Router (presentation/routing)
│   ├── (auth)/                           # unauthenticated routes — no shell
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── onboarding/page.tsx
│   │   ├── pending/page.tsx
│   │   ├── set-password/page.tsx
│   │   └── auth/callback/route.ts        # Supabase OAuth/reset callback (Route Handler)
│   ├── (app)/                            # authenticated routes — render inside AppShell
│   │   ├── layout.tsx                    # AppShell: <TopBar/> + <Sidebar/> + <main/>
│   │   ├── page.tsx                      # Dashboard
│   │   ├── leads/{page.tsx,[id]/page.tsx}
│   │   ├── deals/{page.tsx,[id]/page.tsx}
│   │   ├── contacts/{page.tsx,[id]/page.tsx}
│   │   ├── activities/{page.tsx,[id]/page.tsx}
│   │   ├── calendar/page.tsx
│   │   ├── tools/{page.tsx,portfolio-risk/page.tsx,scripts/page.tsx}
│   │   ├── team/{page.tsx,[id]/page.tsx}
│   │   └── audit-logs/page.tsx
│   ├── api/                              # Route Handlers — ONLY the §12.3 exceptions
│   │   └── notifications/route.ts
│   ├── actions/                          # Server Actions, grouped by module
│   │   ├── leads.actions.ts
│   │   ├── deals.actions.ts
│   │   ├── contacts.actions.ts
│   │   ├── activities.actions.ts
│   │   ├── users.actions.ts
│   │   └── ...
│   ├── globalError.tsx / not-found.tsx
│   └── middleware.ts                     # Supabase session refresh + route gating
│
├── core/                                 # APPLICATION + DOMAIN (framework-free)
│   ├── shared/
│   │   ├── actor.ts                      # Actor type (ported from middleware/context.ts)
│   │   ├── errors.ts                     # Domain errors (NotFound/Forbidden/Conflict/BadRequest…)
│   │   ├── pagination.ts                 # Paginated<T>
│   │   └── result.ts                     # (optional) Result/Either helpers
│   ├── leads/
│   │   ├── leads.service.ts              # use cases (list/get/create/update/claim/return/convert/claimForCall/notes/history)
│   │   ├── leads.authz.ts                # row-level decisions
│   │   ├── leads.rules.ts                # pure domain (status derivations, notif builders)
│   │   ├── leads.schema.ts               # Zod input contracts + inferred types
│   │   └── leads.types.ts                # DTOs
│   ├── deals/ (service, authz, rules[stage machine], schema, types)
│   ├── contacts/ · activities/ · notifications/ · audit/ · users/
│   ├── call-sessions/ · catalog/ · scripts/ · credits/
│   └── credits/credits.rules.ts          # claim/return deltas + transaction builder (shared by leads & deals)
│
├── infra/                                # INFRASTRUCTURE
│   ├── db/prisma.ts                      # singleton PrismaClient (dev-safe global)
│   ├── supabase/{server.ts,client.ts,middleware.ts}  # @supabase/ssr factories
│   └── logger.ts
│
├── components/                           # PRESENTATION (atomic design — §13)
│   ├── atoms/ · molecules/ · organisms/ · templates/
│   └── providers/                        # antd registry, Query, theme, toast
│
├── lib/                                  # presentation-only helpers (format, cn, hooks)
├── prisma/schema.prisma                  # REUSED verbatim from current system
├── docker-compose.yml                    # local Postgres
└── ...
```

> Note the deliberate split: **`core/` is the old `server/modules/` minus Express**. The
> `*.service.ts` / `*.authz.ts` / `*.sideEffects.ts` files port across almost unchanged; only
> the transport (Express routes/controllers) is replaced by Server Actions + RSC.

---

## 6. Domain Layer — Data Model

The Prisma schema is **reused as-is**. Key entities and the relationships an implementer must
respect (snake_case columns ↔ camelCase Prisma fields):

### 6.1 Entities

- **CrmUser** — `id`, `authUserId` (FK→Supabase `auth.users`), `name`, `email`, `role` (`MASTER|ADVISER|TELEMARKETER|null`), `isActive`, `accountStatus` (`ACTIVE|PENDING_PROFILE|PENDING_APPROVAL|REJECTED`), `creditBalance`, `telemarketerAccess`, `telemarketerId`, `leadsAccess`, `requestedRole`, `mustChangePassword`.
- **Lead** — identity + demographics (`salutation, firstName, lastName, email, phone, age, gender, residentialStatus, incomeRange, zipcode`), `source`, `status` (LeadStatus), ownership (`assignedToId, telemarketerOwnerId, adviserOwnerId`), lifecycle (`isAbandoned, abandonedAt, bounceCount, cooldownUntil, lastContactedAt, convertedContactId, convertedAt, appointmentDate, appointmentTime`), fact-find fields, audit (`createdBy, createdAt, updatedAt, deletedAt`).
- **LeadStatusHistory** — append-only status transitions (`leadId, status, changedAt, changedBy, note`).
- **Note** (unified, replaces `LeadNote`/`ContactNote`) — a single provenance-tracked notes timeline that follows a person across the funnel. One row carries: `body`; **provenance** `authorId`, `authorRole` (role *at time of writing*), `phase` (`LEAD|CONTACT|DEAL`), `source` (`COLD_CALL|APPOINTMENT|STATUS_CHANGE|MANUAL|IMPORT|PROPOSAL|FOLLOW_UP`), `isSystem` (true for auto status-change notes); **lineage links** `leadId?`, `contactId?`, `dealId?` (more than one may be set so the whole lineage is queryable); `createdAt`. See §7.8 for the carry-over rules. *(Auto status-change notes from §7.2 are `Note` rows with `isSystem=true`, `source=STATUS_CHANGE`.)*
- **Contact** — person after conversion; carries fact-find fields; soft-deletable.
- **Deal** — `title, value, stage` (DealStage), `leadId?, contactId, telemarketerId?, assignedToId?`, stage-specific fields (`insurer, insurerRef, submittedAt, policyNumber, lostReason, closedAt`), fact-find fields, soft delete.
- **StageHistory** — append-only deal stage transitions (`fromStage?, toStage, changedBy, note`).
- **DealProposal** / **DealProposalLine** — adviser fund proposals; lines reference `fundIsin, fundName, riskRating, allocationPct`.
- **Activity** + **Comment** — CALL/EMAIL/MEETING/TASK/NOTE/FOLLOW_UP with optional `dealId/contactId/leadId`, `result`, schedule/complete timestamps, JSON `metadata`.
- **Notification** — `recipientId, type, title, message, entityType, entityId, isRead, readAt`.
- **AuditLog** — `userId, action` (AuditAction), `entityType, entityId`, JSON `metadata {old,new}`. Immutable.
- **CreditTransaction** — ledger: `userId, leadId?, action` (`CLAIM|RETURN|ADMIN_ASSIGN`), `balanceBefore, balanceAfter`.
- **CallSession** — `userId, startedAt, endedAt?, totalDurationSeconds, callsMade, pickups, leadIds[]`.
- **Catalog** — `Product`, `Bundle`, `BundleProduct`, and the SGA fund set (`SgaFund`, `SgaFundSourceRow`, `SgaFundPlatformAvailability`). Read-mostly reference data.
- **Script** — `id, title, content, createdBy, timestamps, deletedAt`.

### 6.2 Enums (authoritative)

```
LeadStatus      = NA | APPOINTMENT | NOT_INTERESTED | AVOID | KIV | OTHERS | COOLDOWN
LeadSource      = AP_MARKETING | LP_MARKETING | OWN_SOURCE | OTHERS
DealStage       = CALLING | APPOINTMENT | PROPOSAL | SUBMITTED | WON | LOST
ActivityType    = CALL | EMAIL | MEETING | TASK | NOTE | FOLLOW_UP
ActivityResult  = COMPLETED | NO_ANSWER | FOLLOW_UP_NEEDED | MEETING_SCHEDULED | CANCELLED | FAILED
AppointmentResult = MET | NO_SHOW | RESCHEDULED | CANCELLED
FinancialGoal   = RETIREMENT | EDUCATION | WEALTH_GROWTH | INCOME | EMERGENCY_FUND | OTHER
RiskTolerance   = CONSERVATIVE | MODERATE | BALANCED | GROWTH | AGGRESSIVE
InvestmentHorizon = SHORT | MEDIUM | LONG
AuditAction     = CREATE | UPDATE | DELETE | STAGE_CHANGE | ASSIGNMENT_CHANGE | STATUS_CHANGE | CONVERSION | ARCHIVE
CreditAction    = RETURN | CLAIM | ADMIN_ASSIGN
```

### 6.3 Soft-delete & history conventions
- Leads, Contacts, Deals, Activities, Scripts use `deletedAt` soft delete. **Every read filters `deletedAt: null`.**
- History tables (`lead_status_history`, `stage_history`) and `audit_logs` are append-only and never updated/deleted by app code.

---

## 7. Business Rules Catalog (port 1:1 — do not invent)

These are the invariants the system currently enforces in `core` (today's `*.service.ts` +
`*.sideEffects.ts`). They are the heart of the spec.

> **Port vs. new.** §7.1–§7.8 are **ported 1:1** from the live system — implement exactly.
> §7.9–§7.12 are **NEW in this rebuild** (or finish a feature the legacy code left dormant);
> they are flagged **[NEW]** and the design *here* is authoritative. The legacy Vitest suites
> won't cover them, so they need fresh tests.

### 7.1 Credit system (domain: `core/credits/credits.rules.ts`)

> **Scope — ADVISERS ONLY.** The credit system applies **exclusively to ADVISERs**.
> **TELEMARKETERS have no credit balance and never spend or earn credits** — working the
> cold-call pool (`claimForCall`) and converting a lead are always free for a TM. **MASTER**
> claims/releases as an override and is **never** charged or refunded. Any code path that
> debits/credits `creditBalance` must first confirm the actor is an ADVISER; a TM reaching a
> credit mutation is a bug.

- Adviser **claims** an `APPOINTMENT` lead → `creditBalance -= 1`, write `CreditTransaction(CLAIM, before, after)`. Reject with **Conflict** if balance ≤ 0.
- Adviser **returns** a claimed lead → `creditBalance += 1`, write `CreditTransaction(RETURN, …)`.
- Same claim/return semantics for **deals** at `APPOINTMENT` stage.
- **MASTER never spends or refunds credits** when claiming/releasing (it acts as override).
- On **conversion with a delegated/assigned adviser** (§7.3), if that adviser has a credit, the deal is created already-assigned and **that adviser is charged 1 credit** (recorded as `CLAIM`). If they have 0 credits, the deal is left **unassigned** (claim pool) so the appointment is never lost.
- All balance mutations and ledger writes happen **inside the same Prisma transaction** as the row change.

### 7.2 Lead lifecycle & status side-effects (domain: `core/leads/leads.rules.ts`)
On any status write, derive and apply **before** persisting (port of the BEFORE-UPDATE trigger):
- `→ AVOID` (from non-AVOID): set `isAbandoned = true`, `abandonedAt = now`.
- `AVOID →` (to non-AVOID): clear `isAbandoned = false`, `abandonedAt = null`.
- **Any status change** also sets `lastContactedAt = now`.

After persisting, within the same transaction:
- **Status history**: if status changed, append a `LeadStatusHistory` row.
- **Status note**: if status changed, append an auto **`Note`** (`isSystem=true`, `source=STATUS_CHANGE`, `phase=LEAD`) — `"Status changed from {From} to {To}"` (human labels per the `STATUS_LABELS` map).
- **Notifications** (built by a pure `buildLeadNotifications(prev, next)`):
  - `→ APPOINTMENT` & has `assignedToId` → `APPOINTMENT_SET` to assignee.
  - `assignedToId` changed → `LEAD_ASSIGNED` to new assignee.
  - `telemarketerOwnerId` changed → `LEAD_ASSIGNED` ("added to your calling queue") to that TM.
  - `bounceCount` increased & had `telemarketerOwnerId` → `LEAD_BOUNCED` to that TM.
- **Audit**: write `AuditLog(action, entityType:"leads", {old,new})`.

### 7.3 Lead → Appointment conversion (use case: `convertLead`)
Transactional. Steps, in order:
1. Authz: `canConvertLead` (MASTER, any TM, or Adviser with leads/telemarketer access). Reject **Conflict** if lead already `APPOINTMENT`.
2. Resolve contact: use `input.contact_id` → else `lead.convertedContactId` → else **create a Contact** copying identity + fact-find fields.
3. Resolve assignment: if `assigned_adviser_id` provided, caller must be MASTER **or** have that adviser in `delegatedAdviserIds`; adviser must be active ADVISER. Assign+charge **only if** that adviser has credits (else fall back to claim pool).
4. Create **Deal** at stage `APPOINTMENT`, linked to lead+contact, carrying fact-find fields; set `telemarketerId` when the actor is a TM.
5. If assigned, charge that adviser 1 credit (`CreditTransaction CLAIM`).
6. Update the lead: `status=APPOINTMENT`, appointment date/time, `convertedContactId`, `convertedAt=now`, plus status derivations.
7. Side-effects: status history + notifications + audit.
Returns `{ lead, contactId, dealId }`.

### 7.4 Deal stage machine (domain: `core/deals/deals.rules.ts`)
```
VALID_TRANSITIONS = {
  CALLING:     [APPOINTMENT, LOST],
  APPOINTMENT: [PROPOSAL,    LOST],
  PROPOSAL:    [SUBMITTED,   LOST],
  SUBMITTED:   [WON,         LOST],
  WON:         [],   LOST: [],
}
```
- Reject **BadRequest** on any transition not in the map.
- **Conditional required fields** at transition time:
  - `→ SUBMITTED` requires `insurer` + `insurerRef`; set `submittedAt=now`.
  - `→ WON` requires `policyNumber`; set `closedAt=now`.
  - `→ LOST` requires `lostReason`; set `closedAt=now`.
- After transition: append `StageHistory(from,to,changedBy,note)`, emit deal notifications, write audit.

### 7.5 Cold-call pool (use case: `claimForCall`)
- Eligible leads: `deletedAt null`, `isAbandoned false`, `telemarketerOwnerId null`, and (`status NA` **or** `status COOLDOWN` with `cooldownUntil ≤ now`).
- Order by `createdAt asc`, take `count` (1–50, default 15).
- Soft-lock by setting `telemarketerOwnerId = actor.id` (bulk `updateMany`). **No credit cost.** Return the claimed rows.

### 7.6 Onboarding / approval flow (use case: `users.service`)
- New Supabase signup → DB trigger inserts a `crm_users` row in `PENDING_PROFILE`.
- `completeOnboarding(name, requestedRole)` → `PENDING_APPROVAL` (no role granted).
- MASTER `approveUser(id, role)` → `role` set, `isActive=true`, `accountStatus=ACTIVE`, `requestedRole=null`. `rejectUser` → `REJECTED` + `isActive=false`.
- `activateSuperAdmin()` bootstraps the **first** MASTER — succeeds only when **no active MASTER exists** (privilege-escalation guard).
- `mustChangePassword=true` forces a redirect to `/set-password` after login until cleared (§11.4).

### 7.7 Call sessions
- Saved once at session end by the cold-caller; `id` is client-generated; reject **Conflict** on duplicate `id`. Stores duration, calls made, pickups, and the worked `leadIds[]`.

### 7.8 Notes provenance & lineage carry-over (use case: `core/notes`)

> **Requirement.** Every note ever written about a person — by a TM during cold-calling, by an
> Adviser while booking/working the deal, system status-notes, import notes, anything — is
> **never lost** and is **gathered onto the Contact page and the Deal page later**, each note
> clearly tagged with **where it came from** (which funnel phase, which source, which author/role).

**Funnel lineage.** A person is a **Lead** first. They become a **Contact** *only* when they
become interested — i.e. **at conversion to `APPOINTMENT`** (§7.3), which is also when the
**Deal** is created. So a single person can have up to three linked records:

```
Lead.id  ──(convert §7.3)──►  Contact.id  ──┐
   │                                         ├──►  Deal (deal.leadId = Lead.id,
   └──────────── deal.leadId ────────────────┘            deal.contactId = Contact.id)
```
This lineage is reconstructable from existing columns: `lead.convertedContactId`,
`deal.leadId`, `deal.contactId`.

**Write rules.** Whenever a note is created, stamp **all known lineage ids** plus provenance:
- TM note during cold-call on a lead → `{ leadId, phase: LEAD, source: COLD_CALL, authorRole: <TM|MASTER> }`.
- Auto status-change note (§7.2) → `{ leadId, phase: LEAD, source: STATUS_CHANGE, isSystem: true }`.
- Note added on a contact → `{ contactId, phase: CONTACT, source: MANUAL, authorRole: <ADVISER|MASTER> }`.
- Note added on a deal (incl. proposal/fact-find remarks) → `{ dealId, contactId, phase: DEAL, source: MANUAL|PROPOSAL, authorRole: <ADVISER|MASTER> }`. Stamp `contactId` too so deal notes also surface on the contact.

**Carry-over at conversion.** Inside the `convertLead` transaction (§7.3), after the contact id
is known, **back-stamp `contactId` onto all existing lead-phase notes** for that lead
(`UPDATE notes SET contactId = :contactId WHERE leadId = :leadId AND contactId IS NULL`). No note
is moved or copied — the same row now participates in the contact's timeline while **retaining
its original `phase`/`source`/author** so its origin stays visible. Deal notes created later
already carry `contactId`, so they join the same timeline.

**Read rules (aggregation).**
- **Contact page timeline** = all `Note` where `contactId = :id` — this naturally includes the
  carried lead-phase TM notes, contact notes, and deal notes (all stamped with `contactId`),
  ordered by `createdAt`.
- **Deal page timeline** = the **full lineage**: `Note` where `dealId = :id` **OR**
  `contactId = :deal.contactId` **OR** `leadId = :deal.leadId`. The adviser sees the complete
  history including everything the TM captured before the appointment.
- **Lead page timeline** = `Note` where `leadId = :id` (the originating phase only).

**Provenance display (data, not styling).** Each note exposes enough to render an origin tag,
e.g. *"Lead · Cold call · {TM name}"*, *"Lead · Status change · system"*, *"Deal · Proposal ·
{Adviser name}"*. The UI (§13.3 `NotesTimeline`) groups/sorts by `createdAt` and shows the
`phase`+`source`+author badge; it must **not** drop or merge away provenance.

**Authorization.** A note is visible wherever its host record is visible (§8.2). Aggregated
reads run through the same view checks: a contact/deal timeline only returns notes whose lineage
the actor is allowed to see.

### 7.9 Cooldown — retry-later, back to the pool **[NEW]**

> Finishes a dormant legacy feature: `COOLDOWN`/`cooldownUntil` were *read* by `claimForCall`
> but **never written**. This defines the write path.

Domain constant: `COOLDOWN_HOURS = 24` (overridable per call). A cold call that **doesn't reach a
decision** ("no answer / couldn't reach / call back later" outcome) transitions the lead to
**`COOLDOWN`**. Extend `deriveStatusColumns(prev, next)` so that:
- `→ COOLDOWN`: set `cooldownUntil = now + COOLDOWN_HOURS` and **release the soft-lock**
  (`telemarketerOwnerId = null`, `assignedToId = null`) so it rejoins the **shared** pool.
- `COOLDOWN →` (any decisive status): clear `cooldownUntil = null`.

`claimForCall` (§7.5) already re-serves `COOLDOWN` leads once `cooldownUntil ≤ now`, so a cooled
lead silently becomes claimable again when the timer expires. Normal status side-effects (history,
status-note, audit) apply.

### 7.10 Appointment outcomes & no-show bounce **[NEW]**

> Finishes the dormant bounce path: `bounceCount`/`appointmentResult`/`LEAD_BOUNCED` existed but
> nothing incremented them.

Use case `recordAppointmentResult(actor, leadId, { result, cooldownHours? })`, run after the
appointment date. **Authz**: MASTER, the linked deal's assigned adviser, or the lead's
`telemarketerOwnerId`. Domain constant `MAX_BOUNCES = 3`. Transactional:

- **`MET`** → `appointmentResult = MET`; lead stays `APPOINTMENT`; adviser proceeds on the deal. No bounce.
- **`RESCHEDULED`** → `appointmentResult = RESCHEDULED`; stays `APPOINTMENT`; update `appointmentDate/Time` from input. No bounce.
- **`NO_SHOW`** or **`CANCELLED`** → **bounce**:
  - `bounceCount += 1`, `lastBouncedAt = now`, `appointmentResult = result`.
  - Move the **linked deal → `LOST`** (`lostReason = "No-show"|"Cancelled"`, via the §7.4 machine). **If** that deal was adviser-assigned and a credit was spent, **refund 1 credit** (`CreditTransaction RETURN`) — a no-show isn't the adviser's fault (mirrors `releaseDeal`, §7.1 still ADVISER-only).
  - **If** `bounceCount ≥ MAX_BOUNCES` → **abandon**: `status = AVOID` (triggers `isAbandoned=true` via `deriveStatusColumns`); do **not** return to a queue.
  - **Else** → bounce back to the **owning TM's** queue: `status = NA`, **keep** `telemarketerOwnerId` (the original TM, so it lands in *their* list — not the shared pool), clear `adviserOwnerId/assignedToId`. The `LEAD_BOUNCED` notification fires automatically (bounceCount increased & `prev.telemarketerOwnerId` present). `convertedContactId` is retained so a re-book reuses the existing contact.

### 7.11 Notification type catalog (authoritative)

The complete set of `Notification.type` values the system emits (lead types are pure builders in
§7.2; the deal type from `buildDealNotifications`):

| type | trigger | recipient |
|---|---|---|
| `APPOINTMENT_SET` | lead → `APPOINTMENT` with an assignee | the assignee |
| `LEAD_ASSIGNED` | `assignedToId` changed | new assignee |
| `LEAD_ASSIGNED` | `telemarketerOwnerId` changed | that TM ("added to your calling queue") |
| `LEAD_BOUNCED` | `bounceCount` increased & lead had a TM owner (§7.10) | original TM |
| `DEAL_STAGE_CHANGED` | any deal stage transition (§7.4) with an assignee | the deal's assignee |

No new types are introduced by §7.9–§7.10; the no-show flow reuses `LEAD_BOUNCED`.

### 7.12 Deal proposal lifecycle **[NEW — clarifies undefined legacy behavior]**

`DealProposal.status` lifecycle: **`DRAFT → PRESENTED → (ACCEPTED | REJECTED)`**. `createProposal`
starts in `DRAFT`. `updateProposal` may advance status, and the rebuild **enforces** the allowed
transitions (reject jumps like `DRAFT→ACCEPTED` or any change out of a terminal state) instead of
the legacy free-set. On **`ACCEPTED`** (inside the transaction):
- copy `proposal.totalValue` → the parent **`deal.value`**;
- auto-set every **sibling** proposal on the same deal to `REJECTED` (only one accepted per deal).

`DealProposalLine`s (fund ISIN, name, risk rating, allocation %) belong to a proposal; `totalValue`
is maintained on the proposal and is the figure promoted to the deal on acceptance.

---

## 8. Authorization Model (port 1:1)

Authorization has two tiers, both ported from the current system:

1. **Coarse role gate** — `hasRole(actor, minRole)` using levels `TELEMARKETER=0 < ADVISER=1 < MASTER=2`. Used for route/section access.
2. **Row-level decisions** — per-module `*.authz.ts` pure functions that receive the loaded record + the actor. Used inside use cases because they need the row.

**Actor** (resolved once per request from the Supabase session — §11.3):
```
Actor = { id, authUserId, email, role, isActive, creditBalance,
          telemarketerAccess, telemarketerId, leadsAccess,
          delegatedAdviserIds[] }   // advisers who delegated dealing access to this TM
```

### 8.1 Two cross-cutting flags
- **`leadsAccess`** (per-Adviser, MASTER-controlled, default true): gates whether an Adviser can use the Leads module and the cold-call pool. TMs and MASTER always have leads access.
- **TM delegation** (`telemarketerAccess` + `telemarketerId` on an Adviser row): that Adviser has delegated dealing to a TM. At auth time, resolve `delegatedAdviserIds` = advisers who granted the current TM access. The TM may then act on those advisers' leads/deals and book appointments assigned to them.
- **`isColdCaller(user)`** = MASTER ∨ TM ∨ (Adviser ∧ leadsAccess). Drives the calling session / "Start Calling" entry and the TM-style outcome flow. **MASTER is explicitly included** — a Master can run the full "Start Calling" flow (claim-for-call, work the queue, log outcomes, book appointments) exactly like a TM, with no credit cost.

### 8.2 Authorization matrix (entity × action → who)

| Entity / action | Allowed |
|---|---|
| **Leads — list/view** | MASTER (all); Adviser w/ leadsAccess (all) else only own (`assignedToId`/`adviserOwnerId`); TM: own `telemarketerOwnerId`, unowned (`null`), or rows of delegating advisers |
| **Leads — create** | any role |
| **Leads — update** | MASTER; owner Adviser (or any Adviser w/ leadsAccess); TM if owner or delegating-adviser row |
| **Leads — delete (soft)** | MASTER; or the assigned/adviser owner |
| **Leads — claim APPOINTMENT** | MASTER (free) or ADVISER (1 credit) |
| **Leads — claim-for-call** | MASTER, TM, Adviser w/ leadsAccess (or telemarketerAccess) |
| **Leads — convert** | MASTER, TM, Adviser w/ leadsAccess/telemarketerAccess |
| **Leads — TM claim (pool lock)** | TM only, on `NA`/`COOLDOWN`, not owned by another TM (idempotent if self) |
| **Leads — record appointment result** (§7.10) | MASTER; the linked deal's assigned adviser; or the lead's `telemarketerOwnerId` |
| **Global search** (§9) | any authenticated user; results scoped to what they may view |
| **Deals — list/view** | MASTER (all); Adviser: assigned to self or unassigned; TM: own `telemarketerId` or assigned to a delegating adviser |
| **Deals — create** | MASTER, ADVISER (auto-assigns to self), delegated TM |
| **Deals — update / stage / proposals** | MASTER; the deal's owner; delegated TM acting for the assigned adviser |
| **Deals — delete (soft)** | MASTER only |
| **Deals — claim APPOINTMENT** | ADVISER (1 credit) or MASTER (free) |
| **Deals — release** | MASTER, or current `assignedToId`; refunds the **previous owner** if they were an Adviser |
| **Users — list/view** | MASTER (all); others see active users only / themselves |
| **Users — update / approve / reject** | MASTER only |
| **activateSuperAdmin** | anyone, but only when no active MASTER exists |
| **Audit logs** | MASTER only |
| **Scripts — read** | all authenticated |
| **Scripts — create/update/delete** | MASTER only |
| **Call sessions — list** | MASTER (all) else own |

> Implementers: copy the existing `*.authz.ts` predicates verbatim into `core/<module>/*.authz.ts`.
> Use cases call them after loading the row and throw `ForbiddenError` on `false`.

---

## 9. Application Layer — Use-Case Inventory

Each module exposes use cases as `async function(actor, input): Promise<DTO>`. This is the
complete surface (ported from current services). Naming is stable so the agent can map 1:1.

- **leads**: `listLeads`, `getLead`, `createLead`, `updateLead`, `softDeleteLead`, `claimLead`, `returnLead`, `convertLead`, `claimForCall`, `getLeadStatusHistory`, **`recordAppointmentResult`** (§7.10), **`bulkImportLeads`** (§19.3). Cooldown (§7.9) is a status transition through `updateLead` (no separate use case). *(Lead notes go through the unified **notes** module below.)*
- **deals**: `listDeals`, `getDeal`, `createDeal`, `updateDeal`, `softDeleteDeal`, `advanceStage`, `claimDeal`, `releaseDeal`, `getProposals`, `createProposal`, `updateProposal`, `addProposalLine`, `removeProposalLine`, `getStageHistory`.
- **contacts**: list/get/create/update/softDelete.
- **notes** (unified, §7.8): `addNote(actor, { phase, source, leadId?|contactId?|dealId? , body })`, `getLeadNotes(leadId)`, `getContactNotes(contactId)` *(full lineage)*, `getDealNotes(dealId)` *(full lineage)*, `deleteNote(id)`. Author/role/lineage stamping and conversion back-stamping live here; `convertLead` calls the back-stamp helper.
- **activities**: list/get/create/update/softDelete + comments.
- **notifications**: `listForRecipient`, `markRead`, `markAllRead`, unread count.
- **users**: `listUsers`, `getUser`, `updateUser`, `listPendingUsers`, `approveUser`, `rejectUser`, `completeOnboarding`, `activateSuperAdmin`.
- **call-sessions**: `listCallSessions`, `saveCallSession`.
- **catalog**: `listFunds`, `getFund`, `listProducts`, `listBundles` (read-mostly).
- **scripts**: `listScripts`, `getScript`, `createScript`, `updateScript`, `deleteScript`.
- **audit**: `listAuditLogs`.
- **search** (powers the TopBar CommandPalette): `search(actor, q)` → `{ leads, contacts, deals }`, each capped (e.g. top 5), matching name/email/phone/title. **Every result set is filtered by the actor's visibility scope** — it reuses the exact same `where` scope builders as `listLeads`/`listDeals`/`listContacts`, so search never leaks a record the actor couldn't open. Exposed via a Route Handler for debounced typeahead (§12.3).

**Use-case skeleton (the contract every write follows):**
```ts
export async function updateLead(actor: Actor, id: string, input: UpdateLeadInput): Promise<Lead> {
  return prisma.$transaction(async (tx) => {
    const prev = await tx.lead.findFirst({ where: { id, deletedAt: null } });
    if (!prev) throw new NotFoundError("Lead not found");
    if (!canUpdateLead(actor, prev, await sharedAdviserIds(tx, actor))) throw new ForbiddenError();
    const data = toPrismaUpdate(input);
    Object.assign(data, deriveStatusColumns(prev.status, input.status ?? prev.status)); // domain
    if (statusChanged) data.lastContactedAt = new Date();
    const next = await tx.lead.update({ where: { id }, data });
    await recordStatusHistory(tx, …); await recordStatusNote(tx, …);
    await emitLeadNotifications(tx, prev, next); await writeAuditLog(tx, …);
    return next;
  });
}
```

---

## 10. Infrastructure Layer

- **`infra/db/prisma.ts`** — singleton `PrismaClient` stored on `globalThis` in dev to survive HMR; in prod a single instance per lambda. Export a `Tx` type alias for transaction clients (used by side-effect helpers).
- **`infra/supabase/server.ts`** — `createServerClient` (from `@supabase/ssr`) wired to Next `cookies()`; used by Server Components, Server Actions, Route Handlers.
- **`infra/supabase/client.ts`** — `createBrowserClient` for the few client components that need the session (e.g. sign-in form, password set).
- **`infra/supabase/middleware.ts`** — `updateSession(request)` used by `app/middleware.ts` to refresh the auth cookie on every request.
- **`infra/logger.ts`** — `pino` instance; request-scoped child logger keyed by a generated request id.

---

## 11. Auth & Session

### 11.1 Model
- Identity lives in **Supabase Auth** (`auth.users`). Each maps to a `crm_users` row via `authUserId`.
- Sessions are **cookie-based** via `@supabase/ssr` (not localStorage), so RSC and Server Actions can read them.

### 11.2 Middleware (`app/middleware.ts`)
- Runs `updateSession()` to refresh tokens.
- Coarse gate: unauthenticated requests to `(app)/*` → redirect `/login`; authenticated requests to `(auth)/*` → redirect `/`.
- Fine-grained role/`leadsAccess` checks happen in the page/layout (they need the `crm_users` row), not in middleware.

### 11.3 `getActor()` — the single resolver (`core/shared/actor.ts` + infra)
Server-only. Mirrors today's `requireAuth`:
1. Read Supabase user from the cookie session; if none → `UnauthenticatedError`.
2. Load `crm_users` by `authUserId`; require `isActive` + `accountStatus==='ACTIVE'` + a valid role (else Forbidden/redirect to onboarding/pending).
3. If role is TM, resolve `delegatedAdviserIds` (advisers with `telemarketerAccess` + `telemarketerId=actor.id`).
4. Return the `Actor`. **Every use case is called with this Actor** — RSC pages and Server Actions both obtain it via `getActor()`.

A lighter `getSession()` (no active/role requirement) backs onboarding/bootstrap pages, mirroring today's `requireSession`.

### 11.4 Account-status routing (ported)
`PENDING_PROFILE → /onboarding`, `PENDING_APPROVAL|REJECTED → /pending`, `mustChangePassword → /set-password`, else app. The `mustChangePassword` flag is read at login and on session load and forces `/set-password` until the user resets and the flag is cleared (DB + session).

### 11.5 Sign-in / reset
- Email+password sign-in and "forgot/set password" (Supabase `resetPasswordForEmail` with redirect to `/auth/callback?next=/set-password`) are **client components** using the browser Supabase client, then revalidate to the server.

---

## 12. Data Access & API Surface

### 12.1 Reads — React Server Components
- List/detail pages are **async RSC** that call use cases directly: `const { data } = await listLeads(await getActor(), query)`. No client fetching, no API round-trip. Filters/pagination come from `searchParams`.

### 12.2 Writes — Server Actions (`app/actions/*.actions.ts`)
- One thin action per use case: `'use server'`, obtain `getActor()`, Zod-parse input, call the use case, then `revalidatePath`/`revalidateTag` for affected routes. Return a typed `{ ok, data | error }`.
- Forms/buttons in client components invoke actions directly (`useActionState` / `startTransition`). antd `Form.onFinish` → calls the action.

### 12.3 Route Handlers — the **only** sanctioned exceptions
Keep these as HTTP endpoints; everything else is RSC/Actions:
- `app/api/notifications/route.ts` — client **polls** unread notifications on an interval (TanStack Query). Polling fits an HTTP GET better than RSC.
- `app/api/search/route.ts` — **global search** for the CommandPalette: debounced typeahead `GET ?q=` calling the `search` use case (§9). Like notifications, repeated client-driven polling fits HTTP better than RSC.
- `app/(auth)/auth/callback/route.ts` — Supabase auth/reset **callback** (must be a URL Supabase can redirect to).
- *(Future)* any third-party **webhook** (e.g. insurer/payment) lands here.

> Rationale: minimizing Route Handlers keeps the Vercel function/entrypoint footprint small —
> the exact constraint that broke the Express deploy.

### 12.4 Connection pooling (critical on Vercel + Supabase)
- **`DATABASE_URL`** → Supabase **Supavisor transaction pooler** (`:6543`, `?pgbouncer=true&connection_limit=1`) for the serverless runtime.
- **`DIRECT_URL`** → direct `:5432` connection for `prisma migrate`/introspection only.
- Local dev: both point at the Docker Postgres.

### 12.5 Response/error envelope
- Use cases throw typed domain errors (`NotFound`, `Forbidden`, `Conflict`, `BadRequest`, `Unauthenticated`). A shared `toActionError(e)` maps them to `{ code, message }` for actions; Route Handlers map them to HTTP status (404/403/409/400/401) + JSON `{ message, requestId }`.

---

## 13. Presentation Layer — Atomic Design on Ant Design

Components live in `components/{atoms,molecules,organisms,templates}` and pages in `app/`.
**Decision rule for placement:** does it know about the domain? Atoms/molecules = domain-agnostic;
organisms = domain-aware compositions; templates = page skeletons; pages = route entry + data.

### 13.1 Atoms (domain-agnostic, wrap antd)
Thin wrappers/standardizations over antd primitives so the rest of the app never imports antd
directly: `Button`, `Input`, `Select`, `DatePicker`, `Checkbox`, `Switch`, `Tag`/`Badge`,
`Avatar`, `Typography` (Title/Text), `Spinner`, `Tooltip`, `Divider`, `IconButton`, `Money`
(formats SGD), `DateText`, `Skeleton`. *(Maps the current shadcn/ui set onto antd.)*

### 13.2 Molecules (small compositions, still mostly domain-agnostic)
`FormField` (label+control+error), `SearchInput`, `StatusBadge` (LeadStatus/DealStage → color+label),
`StatCard`, `EmptyState`, `ConfirmDialog`, `PageHeader` (title + actions), `Pagination`,
`FilterBar`, `NotificationItem`, `AvatarWithName`, `CreditPill`.

### 13.3 Organisms (domain-aware)
`AppShell`, **`TopBar`**, **`Sidebar`** (§13.6), `LeadsTable`, `LeadDetailPanel`, `LeadImportDialog`
(xlsx parsing — see §13.7), `StatusUpdateModal`, `AppointmentModal`, `DealsBoard`/`DealsTable`,
`DealStageStepper`, `ProposalEditor` (+ lines), `ContactsTable`, `NotesTimeline`
(unified, provenance-tagged §7.8 — renders the aggregated Lead/Contact/Deal notes with phase +
source + author badges; shared by the Lead, Contact, and Deal detail pages), `ActivityTimeline`,
`ActivityForm`, `CallingPanel` / `CallSheet` / `CallOutcomeForm` / `FloatingCallBar`
(the calling-session experience), `NotificationBell` + feed, `CommandPalette` (global search via the §9 `search` use case / §12.3 handler),
`AppointmentResultModal` (§7.10 — MET/NO_SHOW/RESCHEDULED/CANCELLED outcome),
`TeamTable`, `UserApprovalQueue`, `AuditLogTable`, `ScriptEditor`, `PortfolioRiskCalculator`.

### 13.4 Templates (layout skeletons, no data)
`ListPageTemplate` (header + filter bar + table + pagination), `DetailPageTemplate`
(header + tabs + side panel), `BoardPageTemplate` (kanban columns), `AuthPageTemplate`
(centered card for login/onboarding/pending/set-password), `DashboardTemplate` (stat grid + panels).

### 13.5 Pages (route entries)
Async RSC under `app/`: fetch via use cases, pass data into a template + organisms. Client
interactivity is delegated to client-component organisms that call Server Actions.

> **Deferred by decision:** the *contents* of the **Dashboard (`/`)**, **Calendar (`/calendar`)**,
> and **Activities (`/activities`)** read screens (which widgets/stats/queries) are intentionally
> **not specified here** — they'll be defined during the UI/design phase by reverse-engineering
> the current pages. The routes, access rules, and the data they can draw on (the §9 use cases)
> exist; only the composition is open. This is a known TODO, not an oversight.

### 13.6 The two-menu shell (explicit requirement)
`app/(app)/layout.tsx` renders **AppShell** = a persistent **TopBar** + **Sidebar** + `<main>` outlet.

**Sidebar (primary navigation).** Driven by a declarative config (port of today's `navItems` /
`adminItems`), each item carrying a `minRole` (and where relevant a `leadsAccess` requirement);
the Sidebar filters items against the current `Actor` server-side so unauthorized links never render.

| Group | Item | Route | Min role / gate |
|---|---|---|---|
| Main | Dashboard | `/` | TELEMARKETER |
| Main | Leads | `/leads` | TELEMARKETER + leadsAccess |
| Main | Deals | `/deals` | TELEMARKETER |
| Main | Activities | `/activities` | TELEMARKETER |
| Main | Calendar | `/calendar` | TELEMARKETER |
| Main | Contacts | `/contacts` | ADVISER |
| Main | Tools (group) | `/tools` | ADVISER |
| Tools | Portfolio Risk Calculator | `/tools/portfolio-risk` | ADVISER |
| Tools | Script Writing | `/tools/scripts` | MASTER |
| Admin | Team | `/team` | MASTER |
| Admin | Audit Logs | `/audit-logs` | MASTER |

Sidebar uses antd `Menu` (`mode="inline"`, collapsible, sub-menu for Tools). Active item from `usePathname()`.

**TopBar (global utilities).** antd `Layout.Header`: app brand/logo, global **CommandPalette**
trigger (search leads/contacts/deals), **"Start Calling"** entry (visible when `isColdCaller(actor)` — **MASTER, TMs, and leads-access Advisers**),
**NotificationBell** (polled via the Route Handler in §12.3), and a user menu (profile, credit
balance pill for advisers, sign out). Role-conditional items resolve from the `Actor`.

### 13.7 Notable client-side concerns
- **Lead import** (`LeadImportDialog`): parse `.xlsx/.xls/.csv` with `xlsx` in the browser, normalize scientific-notation phone numbers (`8.4E+07 → "84000000"`), map column aliases (`postcode→zipcode`, `income→income_range`, `residential status→residential_status`, `site→` prefixed into notes), preview first rows, then bulk-create via a Server Action using **chunked `createMany`** (≤500/chunk, relaxed side-effects + one summary audit row — §19.3), preserving all demographic fields.
- **Calling session**: client-side timer/queue state (today's `useCallSessionStore`) persisted locally; on end, one `saveCallSession` action.
- **Portfolio Risk Calculator**: client-only computation over the SGA fund list (read via RSC or a cached action).

### 13.8 Providers (`components/providers/`)
`AntdRegistry` (SSR style extraction via `@ant-design/nextjs-registry`), `ConfigProvider` (theme tokens),
`QueryProvider` (TanStack Query for the polled/exception data only), `App` (antd message/notification context for toasts).
These wrap the tree once in the **root** `app/layout.tsx` and are themselves Client Components.

### 13.9 Server vs. Client component convention (antd boundary — the rule)

antd v5 is almost entirely client-side (Context, hooks, css-in-js), so the split must be
**mechanical and obvious**, not judgment-call-by-judgment-call. The rule:

| | Server Component (default) | Client Component (`'use client'`) |
|---|---|---|
| **Lives in** | `app/**/{page,layout}.tsx` | everything in `components/**` |
| **Does** | resolve `getActor()`, fetch via use cases, read `searchParams`, pass **serializable props** down, `revalidate*` | render antd, hold local state, run effects, call Server Actions, use `usePathname`/Query |
| **May import antd?** | **No** (only the providers wrapper in root layout) | **Yes** |
| **Header** | *no* `'use client'` | **first line** `'use client'` |

Enforcement & conventions:
- **Every file under `components/`** (atoms→templates) **starts with `'use client'`.** Treat the entire component library as client. This is the single easiest mental model: *"if it's a reusable UI piece, it's client."*
- **Route files stay server.** `page.tsx`/`layout.tsx` never declare `'use client'`, never import `antd` directly. They are thin: fetch + compose + hand serializable props to client organisms.
- **Mechanical guard:** an ESLint `no-restricted-imports` rule **bans importing `antd` (and `@ant-design/*` icons) anywhere outside `components/`.** A stray antd import in `app/**` is then a lint error, not a silent RSC break.
- **Data crosses the boundary as plain data.** Server pages pass primitives/DTOs (no class instances, no Prisma `Decimal` objects — already stringified per §19.2, no functions) into client components. Server Actions are the *only* functions that cross, imported by client components from `app/actions/*`.
- **Net effect:** the server still does **all** auth, authorization, data fetching and mutations; antd only ever runs in the leaf client components. You can tell a file's nature at a glance from its folder + its first line.

---

## 14. Navigation & Routing Map

| Route | Render | Access |
|---|---|---|
| `/login`, `/register` | AuthTemplate, client form | unauth only |
| `/auth/callback` | Route Handler | Supabase redirect |
| `/onboarding` | profile form | session, `PENDING_PROFILE` |
| `/pending` | status screen | session, `PENDING_APPROVAL`/`REJECTED` |
| `/set-password` | password form | session, `mustChangePassword` |
| `/` | Dashboard (RSC) | active user |
| `/leads`, `/leads/[id]` | RSC + organisms | TELEMARKETER + leadsAccess |
| `/deals`, `/deals/[id]` | RSC + organisms | TELEMARKETER |
| `/contacts`, `/contacts/[id]` | RSC | ADVISER |
| `/activities`, `/activities/[id]`, `/calendar` | RSC | TELEMARKETER |
| `/tools`, `/tools/portfolio-risk` | RSC/client | ADVISER |
| `/tools/scripts` | RSC + ScriptEditor | MASTER |
| `/team`, `/team/[id]` | RSC | MASTER (or self for `[id]`) |
| `/audit-logs` | RSC | MASTER |

Access is enforced **twice**: middleware (auth presence) + the page/layout (role/flags via `getActor()`), and reflected in Sidebar/TopBar item filtering. Unauthorized → a `NoAccess` view (not a raw 403).

---

## 15. Cross-Cutting Concerns

- **Validation**: Zod schemas in `core/<module>/*.schema.ts`, shared by Server Actions and Route Handlers. Inferred types are the use-case input DTOs.
- **Errors**: typed domain errors (`core/shared/errors.ts`); `toActionError` / HTTP mapper at the edges. Never leak Prisma errors to the client.
- **Audit**: every create/update/delete/stage/convert writes an `AuditLog` row **inside the same transaction** (port of `writeAuditLog`).
- **Notifications**: built by pure builders, inserted in-transaction; surfaced via the polled feed.
- **Rate limiting**: **Deferred** (§19.1) — no platform limiter on Vercel Hobby and none added for now, since every mutating action already requires session + role + ownership. Future option: Upstash free-tier `@upstash/ratelimit` on claim/return/stage/convert.
- **Logging**: `pino` server-side with a per-request id; attach to action/handler entry.
- **Soft delete**: every read filters `deletedAt: null`; deletes set `deletedAt`.
- **Money/Decimal**: Prisma `Decimal` serialized as string over the wire; parse with an `asNumber` helper before display.
- **Testing**: keep the existing Vitest suites for `core/**` (services, authz, rules, side-effects) — they port directly since `core` is framework-free. Add a thin layer of action/route tests.

---

## 16. End-to-End Data Flows (walkthroughs)

**A. TM books an appointment from the calling pool**
1. TM clicks "Start Calling" (TopBar, gated by `isColdCaller`). Client calls `claimForCall(actor,{count:15})` action → soft-locks 15 pool leads to the TM, returns them.
2. TM works the queue in `CallingPanel`; each outcome calls `updateLead` (status → KIV/AVOID/NA/…) → derivations + history + status-note + notifications + audit, all in one transaction.
3. On a positive call, `AppointmentModal` → `convertLead(actor, leadId, {appointment_date, …, assigned_adviser_id?})` → creates Contact + Deal(APPOINTMENT), maybe charges an adviser a credit, flips lead to APPOINTMENT, emits `APPOINTMENT_SET`.
4. Session end → `saveCallSession` action persists analytics.
5. RSC revalidation refreshes `/leads` and `/deals`.

**B. Adviser claims and closes a deal**
1. `/deals` RSC lists APPOINTMENT deals visible to the adviser. Claim → `claimDeal` (spends 1 credit, `CreditTransaction CLAIM`, assigns to adviser).
2. Adviser advances stages via `DealStageStepper` → `advanceStage` validates the transition + conditional fields (insurer/policy/lostReason), writes `StageHistory` + audit + notifications.
3. `ProposalEditor` → `createProposal`/`addProposalLine` referencing SGA funds.
4. `→ WON` requires `policyNumber`; sets `closedAt`.

**C. New user onboarding**
1. Supabase signup → trigger creates `crm_users` (`PENDING_PROFILE`).
2. `/onboarding` → `completeOnboarding(name, requestedRole)` → `PENDING_APPROVAL`; user parked on `/pending`.
3. MASTER `/team` approval queue → `approveUser(id, role)` → `ACTIVE`; user gains access on next session load.

---

## 17. Environment & Configuration

```
# Database (Prisma)
DATABASE_URL   = postgres://…@…pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL     = postgres://…@…supabase.com:5432/postgres        # migrations only
# Local dev → both point at docker postgres (localhost:5432)

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL      = https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon key>
SUPABASE_JWT_SECRET           = <for any server-side verification if needed>

# App
NODE_ENV, LOG_LEVEL
```
- `docker-compose.yml` provides local Postgres; `prisma migrate dev` against `DIRECT_URL`.
- Prisma client generated to the **default location** (`node_modules/.prisma/client`) via `postinstall: prisma generate` — predictable Vercel bundling (§19.4).
- **Bulk import** uses chunked `createMany` with relaxed side-effects + one summary audit row (§19.3).

---

## 18. Migration Phasing (suggested)

1. **Scaffold** — Next App Router + antd registry + Prisma (reuse schema) + Supabase SSR clients + Docker Postgres + `getActor()` + middleware. Prove auth round-trip (login → session in RSC).
2. **Port `core/`** — move `server/modules/*` into `core/<module>` (service/authz/rules/schema), drop Express bits, keep Vitest suites green. This is the bulk of the value and carries zero UI risk. **Includes the notes unification (§7.8):** add the `notes` table, migrate existing `lead_notes` → `Note{ phase:LEAD, source: (isSystem status notes → STATUS_CHANGE else COLD_CALL/MANUAL) }` and `contact_notes` → `Note{ phase:CONTACT, source:MANUAL }`, then back-stamp `contactId` onto migrated lead notes whose lead has a `convertedContactId` (one-time backfill mirroring the conversion rule).
3. **Server Actions + RSC pages** — wire actions per use case; build list/detail RSC pages behind plain templates (no styling yet).
4. **Atomic UI on antd** — atoms → molecules → organisms; build the TopBar+Sidebar AppShell; replace placeholders.
5. **Calling session + import + notifications + new flows** — the stateful/polled pieces (§13.7, §12.3) **plus the [NEW] §7.9–§7.12 flows** (cooldown write-path, no-show bounce, proposal lifecycle, global search). These have no legacy tests — write fresh unit tests for each.
6. **Cutover** — point prod at Supabase via the pooler; verify the §16 flows; decommission the Express/Railway service.

---

## 19. Resolved Decisions & Residual Risks

Every item below was an open question and is now **decided**. Free-tier (Vercel Hobby + Supabase Free) is the binding constraint.

1. **Rate limiting → DEFER (no extra service for now).** Vercel Hobby does **not** include platform rate limiting (Vercel Firewall rate-limit rules are Pro+), and we will **not** add one yet. Justification: this is a ~2-user *internal* CRM where **every mutating action already requires a valid Supabase session + role gate + row-ownership check** — the anonymous-flood threat `express-rate-limit` guarded against is essentially absent. **When** it's ever needed (more users, public surface), add **Upstash Redis** `@upstash/ratelimit` on the sensitive actions (claim/return/convert/stage) — Upstash has a real **free tier**, so it stays within budget. Documented, not implemented.
2. **Decimal serialization → DECIDED.** Prisma `Decimal` is serialized as a **string** across the RSC/Action boundary; the client parses with a single `asNumber()` helper at the display edge and **never does float math** on raw values. Applies to `deal.value`, `monthlyInvestable`, `allocationPct`, fund fees/ratings.
3. **Bulk lead import → DECIDED: chunked `createMany`, side-effects relaxed.** Import is a bulk **data load**, not a per-lead user action, so it does **not** emit per-row notifications/status-history/audit. One Server Action inserts in chunks (≤500 rows via `createMany`), preserving all demographic fields, and writes **one summary `AuditLog`** (`CREATE`, `entityType:"leads"`, `metadata:{ imported:N, source:filename }`). This turns 3k sequential transactions into a handful of round-trips — important on the serverless function timeout. (Normal single-lead creation keeps full side-effects.)
4. **`prisma generate` on Vercel → DECIDED.** Keep `postinstall: prisma generate`; generate the client to the **default location** (`node_modules/.prisma/client`), not a custom `prisma/generated` path — this keeps Next/Vercel bundle tracing predictable and avoids stale-output footguns. (Supersedes the "pick one" note in §17.)
5. **antd + RSC → YES, keep antd; boundary made explicit (§13.9).** antd is a fine fit for an internal CRM. The cost is that antd UI is client-rendered; data fetching + auth still happen on the server. The client/server split is made mechanical, not vibes — see the new **§13.9 convention** (rule: `components/**` = Client, `app/**` route files = Server, antd imports banned outside `components/`).
6. **Notification delivery → DECIDED: poll now (✔ agreed).** Client polls `app/api/notifications` via TanStack Query (§12.3). A Supabase **Realtime** channel is the documented future upgrade to drop polling — deferred, not needed for launch.
7. **Notes lineage → DECIDED: back-stamp (§7.8).** At conversion, the person's lead-phase notes are **back-stamped** with the new `contactId` (a denormalized pointer), so the Contact/Deal note timelines are dead-simple `WHERE contactId = …` reads instead of multi-table joins on every page load. *Plain-English:* we tag each old note with "this also belongs to the new contact" the moment the lead becomes a contact, so nothing has to be hunted down later. The **only** caveat: a one-time historical backfill (§18.2) must tag notes for leads that already converted *before* this table existed — skip it and old contacts would show an empty history.

**Residual risks (monitor, no action required to launch):** generated Prisma client size vs. serverless cold-start; Supabase Free connection ceiling under the pooler (sized fine for current usage); antd client bundle size (acceptable for an internal tool).

---

*End of spec. The Domain (§6), Business Rules (§7), and Authorization (§8) sections are
behavioral contracts carried over from the live system — implement them exactly; treat §13–§14
(atomic UI + the two menus) as the structural guide for the presentation layer that visual
design will later dress.*
