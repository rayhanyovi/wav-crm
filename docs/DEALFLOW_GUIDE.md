# Dealflow CRM — Product Guide & Demo Companion

> **Codename:** Dealflow (DFL) · **Part of:** WAV — Wealth Advisory Venture
> Agent-facing CRM for a Singapore wealth-advisory firm that sells investment
> products (funds, bonds, structured products) through a network of telemarketers
> and licensed advisers.

This document explains **what the app is, who uses it, how access works, and the
end-to-end flows** — written so it can be read top-to-bottom before a live demo.

---

## 1. What Dealflow Does

Dealflow is the pipeline that turns a **cold lead** into a **won client**:

```
   Leads  ──(call & qualify)──►  Appointment  ──(convert)──►  Deal  ──►  WON ► (client handed to Vault)
   ▲                                                            │
   └────────── telemarketers work here          advisers work here ──────┘
```

- **Telemarketers** call leads, qualify them, and book appointments.
- **Advisers** take qualified prospects, meet them, build an investment proposal, and close.
- **Master/Admin** oversees everyone, assigns credits, and audits activity.

Everything is backed by a shared Supabase (PostgreSQL) database with **row-level
security**, so each user only sees the records their role allows.

---

## 2. Roles & the Four Personas

There are **three system roles** (`MASTER`, `ADVISER`, `TELEMARKETER`) but **four
real-world personas**, because an adviser can also be configured to telemarket, and
a telemarketer can be granted dealing access.

| Persona | Label | System role | Defining configuration |
|---------|-------|-------------|------------------------|
| **A** | **Pure Telemarketer** | `TELEMARKETER` | Calls leads only. No dealing access. |
| **B** | **Pure Adviser** | `ADVISER` | Works deals only. Does not appear in any leads queue. |
| **C** | **Adviser who also Telemarkets** | `ADVISER` | An adviser who also makes calls. Still an adviser at heart. |
| **D** | **Telemarketer with Dealing Access** | `TELEMARKETER` | A TM whom an adviser has linked via `telemarketer_access` + `telemarketer_id`, so the TM works that adviser's pipeline. |

> **Key nuance for the demo:** Persona C is still an **adviser** to the system —
> when *they* book an appointment it self-claims to them (like Persona B). Persona D
> is still a **telemarketer** — when *they* book an appointment it claims to the
> **adviser who granted them access**.

---

## 3. Who Can See What (Access Model)

Enforced at the database level via RLS, mirrored in the UI:

| | **Leads** | **Deals** |
|---|---|---|
| **Pure Telemarketer (A)** | ✅ Sees **all** leads (the calling pool) | ❌ No deals |
| **Pure Adviser (B)** | ❌ No leads | ✅ Sees **own** deals + open/claimable pool |
| **Adviser + Telemarketing (C)** | ✅ Sees all leads (telemarketer_access flag) | ✅ Own deals |
| **TM + Dealing access (D)** | ✅ Sees their/linked leads | ✅ Sees deals of the adviser(s) who granted access |
| **Master** | ✅ Everything | ✅ Everything |

**Rule of thumb:** *Telemarketers live in **Leads**, advisers live in **Deals**.* The
overlap personas (C and D) bridge both.

---

## 4. The Credit System

Credits are how the firm rations who gets to **own** a warm prospect.

- An **adviser claims an appointment by spending 1 credit.**
- Claiming can happen two ways:
  - **Automatically**, the moment a lead is moved to Appointment (if the actor or
    their linked adviser is eligible — see §6).
  - **Manually**, by an adviser picking an unclaimed deal from the pool.
- If **no one has a credit**, the deal sits **unassigned in the open pool** and any
  adviser can claim it later.
- Releasing a deal back to the pool **refunds the credit** (`+1`), so a warm
  prospect an adviser can't service isn't wasted.

> Credits create healthy competition for good prospects and prevent hoarding.

---

## 5. The Two Lifecycles

### 5a. Lead Status (the telemarketer's world)

| Status | Meaning |
|--------|---------|
| `NA` | Not yet reached / no answer — the default working state |
| `KIV` | "Keep In View" — interested but not now; schedules a follow-up |
| `NOT_INTERESTED` | Declined |
| `AVOID` | Do-not-call / hostile / bad contact → **abandoned**, hidden from queue |
| `OTHERS` | Language/technical/other |
| `COOLDOWN` | Temporarily rested before recontact |
| `APPOINTMENT` | **Qualified** — leaves the Leads list and becomes a **Deal** |

Each status change is logged with a **reason** (e.g. "Voicemail Left", "Already Has
Coverage") and surfaces later as a comment on the deal.

### 5b. Deal Stage (the adviser's world)

```
CALLING → APPOINTMENT → PROPOSAL → SUBMITTED → WON
                                          └────► LOST  (with reason)
```

| Stage | Meaning |
|-------|---------|
| `APPOINTMENT` | Booked; awaiting/owned for the meeting |
| `PROPOSAL` | Fact-find done, fund allocation plan built |
| `SUBMITTED` | Application sent to the insurer/provider (captures insurer + ref) |
| `WON` | Closed; policy number captured; client moves to Vault |
| `LOST` | Dead, with a recorded reason |

---

## 6. Appointment → Deal Assignment Rules (the heart of the demo)

When **any** persona moves a lead to **Appointment**, a deal is created. *Who owns
it* depends on who did it:

| Who moves it to Appointment | Result |
|-----------------------------|--------|
| **A — Pure Telemarketer** | Deal created **UNASSIGNED**. Sits in the pool; an adviser claims it later. |
| **B — Pure Adviser** (has credit) | **Auto-claimed by himself**, spends 1 credit. |
| **B — Pure Adviser** (no credit) | **Unassigned** — claimable by anyone. |
| **C — Adviser who telemarkets** | Same as B (still an adviser actor). |
| **D — TM with dealing access** (granting adviser has credit) | **Auto-claimed by the granting adviser**, spends that adviser's credit. Routes to the lead's own adviser if several grant access. |
| **D — TM with dealing access** (granting adviser no credit) | **Unassigned** — back to the open pool. |

> These rules are unit-tested in
> [`src/lib/dealAssignment.test.ts`](../src/lib/dealAssignment.test.ts) and as
> end-to-end journeys in
> [`src/lib/appointmentFlow.test.ts`](../src/lib/appointmentFlow.test.ts).

---

## 7. The Screens (what you'll click through)

| Screen | Who uses it | What it's for |
|--------|-------------|---------------|
| **Dashboard** | All | Snapshot of pipeline, stats |
| **Leads** | A, C, D, Master | The calling pool. Search, filter, sort, status-change, "Move to Appointment". |
| **Deals** | B, C, D, Master | The pipeline. Claim, advance stage, mark lost. |
| **Deal detail** | B, C, D, Master | Fact-find, **investment proposals** (fund allocation), **Comments & Activity**, stage stepper, release/transfer. |
| **Activities** | All | Read-only **log** of every call, meeting, status change, comment. Clicking a row jumps to the related deal/lead. |
| **Calendar** | All | Scheduled appointments & follow-ups. |
| **Contacts** | B, C, Master | People converted from leads. |
| **Tools → Portfolio Risk Calculator** | Advisers | Browse the 2,195-fund catalog, build a sample portfolio, see weighted risk. |
| **Team / Audit Logs** | Master | User management, credit assignment, full audit trail. |

---

## 8. The Golden Flow (Case A → B)

> **"Telemarketer → Adviser → Appointment → Win"** — the ideal journey.

| # | Step | Persona | What happens in the app |
|---|------|---------|-------------------------|
| 1 | Leads loaded into the pool | Master/import | Leads appear in the **Leads** table with status `NA`. |
| 2 | TM calls a lead | **A** | Opens the lead, logs the call. |
| 3 | Client is interested, wants to meet | — | TM picks **Move to Appointment** from the row's ⋯ menu. |
| 4 | TM books the appointment | **A** | Deal is created **UNASSIGNED**. A dot **flies to the Deals tab** and the lead row fades out of the queue. |
| 5 | Adviser claims the prospect | **B** | On **Deals**, the adviser sees the unclaimed appointment and **claims it (−1 credit)**. |
| 6 | They meet on the scheduled day | **B** | Appointment shows on the **Calendar**; adviser records the meeting. |
| 7 | Client shares their plan | **B** | Adviser fills the **Fact Find** (goal, risk tolerance, horizon, investable amount). |
| 8 | Adviser models the portfolio | **B** | Uses the **Portfolio Risk Calculator** / builds an **Investment Proposal** with fund allocations and weighted risk. |
| 9 | They agree | **B** | Proposal status → Accepted; deal advances `PROPOSAL → SUBMITTED` (insurer + ref captured). |
| 10 | Paperwork done off-system | **B** | (External provider submission.) |
| 11 | Adviser marks the client **Won** | **B** | Stage → `WON`, policy number captured. Client is ready to hand to Vault. |

Throughout, the call note, the status-change reason, and the meeting note all
appear as **Comments** on the deal page — one continuous history from first dial to close.

---

## 9. Use Cases per Persona (the variant flows)

### Use Case B — Pure Adviser sources and closes their own lead
1. Adviser (Persona C config, or working a self-sourced lead) moves a lead to Appointment.
2. **Has credit →** deal auto-claims to **himself** (−1 credit). Goes straight to step 6 of the golden flow.
3. **No credit →** deal lands **unassigned**; he (or another adviser) claims it once a credit is available.

### Use Case C — Adviser who also telemarkets
- Behaves exactly like Persona B for ownership: when he books the appointment it
  self-claims (credit permitting). The only difference from a pure adviser is that
  **he can also see and work the Leads queue.**

### Use Case D — Telemarketer with dealing access books an appointment
1. TM (linked to adviser *Junhao* via `telemarketer_access`) books an appointment.
2. **Junhao has credit →** deal **auto-claims to Junhao** (−1 of Junhao's credits). The TM did the calling; the adviser owns the deal automatically.
3. **Several advisers grant the TM access →** routes to the **lead's own adviser** (`adviser_owner_id`/`assigned_to_id`). If ambiguous (no owner), it stays unassigned.
4. **Granting adviser out of credit →** deal falls back to the **open pool**.

### Edge case — the open pool
- Any time no eligible adviser has a credit, the deal is **claimable by anyone**.
- An adviser who claims but later can't service the client can **Release** it
  (refund +1 credit) or **Transfer** it directly to a colleague.

---

## 10. Activities & Comments Model

- **Activities are logs, not destinations.** A call, a status change, a meeting, a
  comment — each is one activity row. They have **no detail page**: clicking one
  jumps to the **deal** (or lead/contact) it belongs to.
- **The deal page is the single source of truth.** Its **Comments & Activity**
  panel aggregates everything from the originating lead *and* the deal: the first
  call note, every status-change reason, meeting notes, and free-form comments — in
  one timeline. Advisers can post new comments inline (⌘/Ctrl+Enter).

---

## 11. Recent UX Polish (worth showing)

- **Instant status changes** — picking a status updates the table immediately
  (optimistic); if the backend rejects it, the row reverts and a toast explains why.
- **Add-to-cart conversion animation** — moving a lead to Appointment flies a dot to
  the **Deals** tab and fades the row out of the queue.
- **Sortable Leads table** — click any column header (Name, Status, Source, Last
  Contacted) to sort.
- **Toasts** for mutation errors so nothing fails silently.

---

## 12. Suggested Demo Script (≈5 min)

1. **Frame it** — "Telemarketers fill the pipeline, advisers close it. Credits decide who owns a prospect." (§1, §4)
2. **As a Telemarketer (Persona A):** open Leads → sort/filter → change a status (show the instant update + reason) → **Move to Appointment** → watch the dot fly to Deals. (§7, §8 steps 1–4)
3. **As an Adviser (Persona B):** open Deals → the new appointment is **unclaimed** → **claim it** (credit drops). (§6, §8 step 5)
4. **On the Deal:** fill the Fact Find → build a proposal with the **Portfolio Risk Calculator** → show **Comments & Activity** carrying the whole history. (§8 steps 7–8, §10)
5. **Close it:** advance `SUBMITTED → WON`, capture policy number. (§8 steps 9–11)
6. **Show the variants:** "If an adviser had booked it themselves it would auto-claim; if their telemarketer booked it, it auto-routes to that adviser." (§6, §9)
7. **Trust layer:** Master view → Audit Logs + credit assignment. (§7)

---

## 13. Tech Notes (for technical audiences)

- **Stack:** Vite + React 19 + TypeScript, Tailwind v4, Radix/shadcn UI, Zustand
  (UI state), TanStack Query (server state), Recharts.
- **Backend:** Supabase (PostgreSQL) — RLS policies + `SECURITY DEFINER` RPCs
  (`rpc_update_lead`, `convert_lead`, `claim_lead`, `return_lead`, `release_deal`)
  for atomic multi-table operations. DB triggers handle audit logging, status
  history, and notifications.
- **Assignment logic:** [`src/lib/dealAssignment.ts`](../src/lib/dealAssignment.ts).
- **Tests:** `npm test` (Vitest) — assignment matrix + full persona journeys.
