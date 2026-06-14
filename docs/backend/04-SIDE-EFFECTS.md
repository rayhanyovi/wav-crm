# 04 — Side-Effects (triggers/RPCs → app layer)

Per the chosen strategy, **all DB triggers and RPC business logic move into the
Express service layer** so behavior is portable. Each effect becomes an explicit
step inside the service's Prisma `$transaction`, committing atomically with the
write that caused it.

Pattern (see `modules/leads/leads.sideEffects.ts` for the reference):
- **Pure builders** compute what should happen (e.g. `buildLeadNotifications(prev,
  next) → rows[]`) — unit-tested without a DB.
- **I/O helpers** (`record*`, `emit*`, `writeAuditLog`) take the transaction
  client and persist.
- The service loads `prev`, writes, then runs the effects against the same `tx`.

## leads ✅ (ported)

### `fn_lead_status_side_effects` (BEFORE UPDATE)
```sql
IF NEW.status = 'AVOID' AND OLD.status IS DISTINCT FROM 'AVOID' THEN
  NEW.is_abandoned := true; NEW.abandoned_at := now();
END IF;
IF NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO lead_status_history (lead_id, status, changed_by)
  VALUES (NEW.id, NEW.status, <app.crm_user_id>);
END IF;
```
→ `deriveStatusColumns(prev, next)` + `recordStatusHistory(tx, …)`.

### `fn_notify_appointment_set`, `fn_notify_lead_assigned`, `fn_notify_lead_bounced` (AFTER UPDATE)
- →APPOINTMENT (prev≠APPOINTMENT) ∧ `assigned_to_id` set → `APPOINTMENT_SET` notif.
- `assigned_to_id` changed & set → `LEAD_ASSIGNED` notif to assignee.
- `telemarketer_owner_id` changed & set → `LEAD_ASSIGNED` notif to TM.
- `bounce_count` increased ∧ old `telemarketer_owner_id` set → `LEAD_BOUNCED`.

→ `buildLeadNotifications(prev, next)` + `emitLeadNotifications(tx, …)`.

### `rpc_update_lead`
Patch-merge semantics: only keys present in the payload are written; absent keys
keep their value (`jsonb_populate_record`). Sets `app.crm_user_id` so the trigger
can stamp `changed_by`. → `toPrismaUpdate(input)` (only provided keys) + the
status side-effects above, with `changedBy = actor.id`.

### `fn_audit_log` (AFTER INSERT/UPDATE/DELETE)
Insert `audit_logs(user_id, action, entity_type, entity_id, metadata{old,new})`.
→ `writeAuditLog(tx, …)` called at the end of every mutating service method.

## Credit ledger — `claim_lead` / `return_lead` (to port)

`claim_lead(lead, user)` in one transaction:
1. `SELECT credit_balance … FOR UPDATE` (row lock).
2. If `null` or `< 1` → raise `Insufficient credits` (→ map to 409/422).
3. `credit_balance -= 1`; set `leads.assigned_to_id = user`.
4. Insert `credit_transactions(action='CLAIM', balance_before, balance_after)`.
5. Return `{ success, new_balance }`.

`return_lead` is the inverse (+1 credit, clear assignment, `action='RETURN'`).
Port with `prisma.$transaction` + a `SELECT … FOR UPDATE` equivalent
(`prisma.$queryRaw` row lock, or serializable isolation) to keep it race-safe.

## `convert_lead` (to port)

Creates a `contact` (and optional `deal`) from a lead, links
`leads.converted_contact_id`/`converted_at`, returns `{ contact_id, deal_id }`.
Wrap all inserts + the lead update in one transaction; carry over fact-find
fields (see the frontend `pickFactFind`).

## deals — `fn_notify_deal_assigned`, `fn_notify_deal_stage`, `stage_history`

On stage move: insert `stage_history(from, to, changed_by, note)` + emit
stage/assignment notifications, all in the move-stage transaction.

## Onboarding — `handle_new_auth_user`

Today a Supabase trigger auto-creates a `crm_users` row when an auth user signs
up. In Phase 1 (Supabase Auth retained) this can stay as-is; when auth moves to
the backend, replace it with a service step in the signup/onboarding endpoint.

## How to fetch any trigger/RPC body for porting

```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname = '<name>';
```

Port faithfully, add a pure-function unit test per branch, and keep the SQL in a
comment header (as the leads slice does) so reviewers can diff behavior.
