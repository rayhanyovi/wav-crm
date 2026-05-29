# WAV CRM — Dev Context

Last updated: 2026-05-29

---

## Stack

Vite + React 19 + TypeScript + Tailwind CSS v4 + Radix UI (shadcn) + Zustand (persist) + Recharts

State: `src/store/useCrmStore.ts` (persisted to localStorage), `src/store/useAuthStore.ts`, `src/store/useCallSessionStore.ts`

Seed data: `src/data/seed.json` — 199 leads, 59 contacts, 59 deals, 5 users

---

## Users (seed)

| ID | Name | Role | Notes |
|----|------|------|-------|
| user-1 | Marcus (MASTER) | Admin | Sees everything |
| user-2 | Javier (ADVISER) | Adviser | Has telemarketer_access: true, telemarketer_id: "user-4" |
| user-3 | Junhao (ADVISER) | Adviser | Has telemarketer_access: true, telemarketer_id: "user-4" |
| user-4 | Yinesa (TM) | Telemarketer | Linked to both Javier & Junhao |
| user-5 | Zee (TM) | Telemarketer | Not linked to any adviser |

---

## Data Model — Key Rules

- **Leads** = TM territory (status: NA, NOT_INTERESTED, ABANDON, OTHERS). APPOINTMENT leads are hidden from Leads page — they live in Deals.
- **Deals** = Adviser territory (stage: APPOINTMENT → PROPOSAL → SUBMITTED → WON/LOST)
- **Contacts** = Converted leads (created automatically when TM logs MEETING_SCHEDULED)
- When TM logs **MEETING_SCHEDULED**: lead → APPOINTMENT, auto-create Contact + Deal (assigned to adviser from lead.assigned_to_id)
- `telemarketer_owner_id` on Lead: which TM owns/can call it
- `assigned_to_id` on Lead: adviser it's been handed to
- `adviser.telemarketer_id`: which TM can see and call this adviser's leads

---

## Recently Completed

### Campaign removal (73bb52f)
- Deleted `src/lib/campaignOfferings.ts`
- Removed all Campaign types, state, UI from all 16 affected files
- `useCallSessionStore.startSession(queue: Lead[])` — no longer takes campaign

### Company removal (936cf7d)
- B2C only — deleted CompaniesPage, CompanyDetailPage, Company type
- Removed `company_id` from all models

### Calling flow (earlier commits)
- `StartCallingModal` — no campaign selector; TM queue = their NA leads (bounced float top); Adviser queue = APPOINTMENT leads + deal leads
- `CallOutcomeForm` — TM sees 5 radio cards (Meeting Scheduled / Not Answered / Bad Data / Follow Up Needed / Rejected); adviser sees dropdown
- `FloatingCallBar` — shows "TM Call Queue" or "Follow-up Queue"

### Fact Find
- Editable in `DealDetailPage` and `ContactDetailPage`
- Fields: Financial Goal, Risk Tolerance, Investment Horizon, Monthly/Annual Investable, Existing Investments, Notes
- In ContactDetailPage: if no deal exists yet, auto-creates one on save

### Deals page (7a995c3)
- Table layout: Client · Stage · Adviser · Value · Activity · Updated · Claim

### Calendar (7a995c3)
- Scoped per user by default
- MASTER: sees all, "All Owners" dropdown
- Adviser/TM: sees only own activities
- TM with linked-adviser (telemarketer_id match): can also select that adviser in owner dropdown

### Leads page (7a995c3)
- APPOINTMENT leads hidden (they're in Deals now)
- STATUSES available: NA, NOT_INTERESTED, ABANDON, OTHERS

---

## Pending / What to work on next

- **Lead → Contact conversion UX**: currently auto-happens in CallOutcomeForm, but the Leads page still shows a "Convert" flow — could clean this up
- **Deal auto-title**: right now auto-created deals from MEETING_SCHEDULED use just the client name — could improve
- **Activity subject naming**: seed uses `TM Call —`, `First Meeting —` etc. Runtime uses `Call —`, `Meeting —` — not yet standardised
- **No Prisma/Supabase yet**: everything is still localStorage mock. Phase 0 infra (Supabase schema) is separate in `wav-db-schema/`
- **Atlas (fund catalog)** is the next big phase (ATL-001 blocks 6 other projects)

---

## File Map (key files)

```
src/
  data/
    types.ts          — all TypeScript interfaces & enums
    seed.json         — mock data (199 leads, 59 contacts, 59 deals)
  store/
    useCrmStore.ts    — main Zustand store (leads, deals, contacts, activities…)
    useAuthStore.ts   — current logged-in user
    useCallSessionStore.ts — active calling session state
  lib/
    permissions.ts    — isMaster, isAdviser, isTelemarketer, canEdit, can
    selectors.ts      — getLeadActivities, getDealActivities, getTodayCallStats…
    format.ts         — formatCurrency, formatDate, formatDuration…
  pages/
    LeadsPage.tsx     — TM territory, APPOINTMENT excluded
    DealsPage.tsx     — table layout, APPOINTMENT+
    CalendarPage.tsx  — per-user scoped
    ContactDetailPage.tsx  — includes editable Fact Find card
    DealDetailPage.tsx     — includes editable Fact Find + proposals
  components/
    calling/
      StartCallingModal.tsx   — queue builder by role
      CallSheet.tsx           — lead info sheet during call
      CallOutcomeForm.tsx     — TM radio cards / adviser dropdown; auto-creates deal on MEETING_SCHEDULED
      FloatingCallBar.tsx     — persistent bottom bar during session
    layout/
      navigationItems.ts      — nav links
      TopBar.tsx / Sidebar.tsx
```
