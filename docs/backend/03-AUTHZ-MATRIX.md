# 03 — Authorization Matrix (RLS → app layer)

The backend **bypasses RLS**. Every rule below must be enforced in `*.authz.ts`
and called by the service. Captured from the live DB on 2026-06-14.

Helpers (port of the SQL helpers):
- `actor.role` ← `get_crm_role()`
- `actor.id` ← `get_crm_user_id()`
- `hasRole(actor, min)` ← role-level comparison (TELEMARKETER < ADVISER < MASTER)

## leads ✅ (ported in `leads.authz.ts`)

| Action | RLS policy (live) | App-layer rule |
|--------|-------------------|----------------|
| SELECT | MASTER ∨ TELEMARKETER ∨ (ADVISER ∧ `telemarketer_access`) | `canListLeads` / `canViewLead` |
| INSERT | role ∈ {MASTER, ADVISER, TELEMARKETER} | `canCreateLead` |
| UPDATE | MASTER ∨ TELEMARKETER ∨ (ADVISER ∧ `telemarketer_access`) | `canUpdateLead` |
| DELETE | MASTER ∨ `assigned_to_id = me` ∨ `adviser_owner_id = me` | `canDeleteLead(actor, row)` |

> ⚠️ RLS uses `telemarketer_access`; the frontend uses `leads_access`. Mirror the
> DB for now, flag for product. See 00-AUDIT.md finding #2.

## deals (6 policies — port next)

| Action | App-layer rule |
|--------|----------------|
| SELECT | MASTER ∨ `assigned_to_id = me` ∨ `created_by = me` ∨ (TELEMARKETER ∧ deal's adviser granted them access) |
| SELECT (released) | ADVISER ∧ `assigned_to_id IS NULL` ∧ `stage <> CALLING` |
| UPDATE | MASTER ∨ `assigned_to_id = me` |
| UPDATE (claim released) | ADVISER ∧ `assigned_to_id IS NULL` ∧ `stage <> CALLING`, **and the resulting row must set `assigned_to_id = me`** (claim-only) |
| INSERT | role ∈ {MASTER, ADVISER} |
| DELETE | MASTER ∨ `assigned_to_id = me` |

> This is the source of the `42501` "Mark as Lost on a released deal" bug —
> only the claim policy lets an adviser write a released deal, and it requires
> claiming. App rule: stage changes need MASTER or ownership; releasing a deal
> for mark-lost must be claimed first.

## crm_users (4 policies)

| Action | Rule |
|--------|------|
| SELECT | self ∨ MASTER ∨ (visible team members per role) |
| UPDATE | MASTER (role/credit/access/approval) ∨ self (limited profile fields) |
| INSERT | via `handle_new_auth_user` trigger only (port: `/api/onboarding`) |

## Pattern for the remaining tables

For each table, run this and translate each policy into a pure function:

```sql
SELECT polname,
  CASE polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
              WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END AS cmd,
  pg_get_expr(polqual, polrelid)      AS using_expr,
  pg_get_expr(polwithcheck, polrelid) AS check_expr
FROM pg_policy
WHERE polrelid = 'public.<table>'::regclass;
```

Rules:
- `USING` → who may read/select the row for the action.
- `WITH CHECK` → what the **resulting** row must satisfy (write constraints,
  e.g. "can only set assigned_to_id = me").
- Ownership checks need the loaded row, so they go in the service after a fetch,
  not in a route guard.
- When in doubt, deny. Add a test per rule (see 06-TESTING.md).
