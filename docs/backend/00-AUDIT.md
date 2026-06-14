# 00 — Backend-Dependency Audit

_What the frontend (`wav-crm-nextjs`) depends on the backend for, verified
against the live Supabase project `auyynqzrhwsxbtukrbri` on 2026-06-14._

## How the frontend talks to the backend today

All data access goes through `@supabase/supabase-js` (`src/lib/supabase.ts`),
called from the `src/services/*.ts` layer and consumed via TanStack Query hooks
in `src/hooks/*.ts`. There is **no existing API boundary** — the browser holds
the Supabase anon key and RLS does the authorization. The migration goal is to
put an Express API in the middle so the data store and auth become swappable.

## Tables hit (22, all RLS-enabled)

| Table | Est. rows | Notes |
|-------|-----------|-------|
| `leads` | 2,398 | Highest-traffic. Status funnel, ownership, fact-find, cooldown/bounce. |
| `deals` | 60 | Stage pipeline, released/claim, proposals. |
| `contacts` | 59 | Converted leads. |
| `activities` | — | Calls/meetings/notes/follow-ups; calendar. |
| `crm_users` | — | Roles, credit_balance, telemarketer/leads access, onboarding status. |
| `deal_proposals`, `deal_proposal_lines` | — | Fund allocation proposals. |
| `comments` | — | Threaded comments on entities. |
| `lead_notes`, `contact_notes` | — | Free-form notes. |
| `stage_history`, `lead_status_history` | 121 / 82 | Audit trails for stage/status. |
| `notifications` | — | In-app notifications (written by triggers). |
| `call_sessions` | — | TM calling-session telemetry. |
| `credit_transactions` | — | Credit ledger (written by `claim_lead`/`return_lead`). |
| `products`, `bundles`, `bundle_products` | — | Product catalog. |
| `audit_logs` | 817 | Append-only audit (written by `fn_audit_log`). |
| `calling_leads`, `lead_import_reference`, `sga_funds`, `calling_scripts` | 2199 / 3000 / 2195 / 63 | Staging/reference; not all hit directly by the UI. |

Census command used:
`grep -rhoE '\.from\("[a-z_]+"\)' src | sort | uniq -c`

## Business RPCs (must become endpoints — see 02-API-SPEC.md)

| RPC | Returns | Purpose |
|-----|---------|---------|
| `claim_lead(p_lead_id, p_user_id)` | `{success, new_balance}` | Adviser claims a lead, spends 1 credit, writes `credit_transactions`. |
| `return_lead(p_lead_id, p_user_id)` | `{new_balance}` | Return a claimed lead, refund credit. |
| `convert_lead(p_lead_id, p_contact, p_deal, p_user_id)` | `{contact_id, deal_id}` | Lead → contact + deal. |
| `release_deal(p_deal_id, p_releaser_id, p_transfer_to)` | jsonb | Release/transfer a deal. |
| `rpc_update_lead(p_id, p_payload, p_user_id)` | lead json | Patch a lead + fire status side-effects (ported in the leads slice). |
| `approve_user(p_user_id, p_role)` | crm_users | Admin approves a pending signup. |
| `reject_user(p_user_id)` | crm_users | Admin rejects a pending signup. |
| `complete_onboarding(p_name, p_requested_role)` | crm_users | User finishes onboarding. |
| `activate_super_admin()` | void | Self-activate the pre-configured master. |

## Auth (Supabase Auth today)

`signInWithPassword`, `signInWithOtp` (magic link), `getSession`,
`onAuthStateChange`, `signOut`, `updateUser`. Phase 1 keeps Supabase Auth and
has the backend **verify the access token** — see 01-ARCHITECTURE.md §Auth.

## Hidden side-effects — DB triggers (must be ported; see 04-SIDE-EFFECTS.md)

| Trigger | Fires on | Effect |
|---------|----------|--------|
| `fn_lead_status_side_effects` | leads BEFORE UPDATE | Set `is_abandoned`/`abandoned_at` on →AVOID; insert `lead_status_history`. |
| `fn_notify_appointment_set` | leads AFTER UPDATE | Notification on →APPOINTMENT. |
| `fn_notify_lead_assigned` | leads AFTER UPDATE | Notification on assignee / TM-owner change. |
| `fn_notify_lead_bounced` | leads AFTER UPDATE | Notification when `bounce_count` increases. |
| `fn_notify_deal_*` | deals AFTER UPDATE | Notifications on deal assign/stage. |
| `fn_audit_log` | many tables AFTER I/U/D | Insert `audit_logs` row with old/new. |
| `handle_new_auth_user` | auth.users AFTER INSERT | Auto-create `crm_users` row on signup. |

Auth/permission helpers used by every RLS policy:
`get_crm_role()` and `get_crm_user_id()` (look up `crm_users` by
`auth_user_id = auth.uid()`).

## ⚠️ Findings to resolve

1. **The committed `wav-crm-nextjs/db/prisma/schema.prisma` is a stale v1
   prototype** — wrong roles (`AGENT/ADMIN/FINANCE`), wrong enums
   (`NEW/CONTACTED/…`), wrong table names (`User` vs `crm_users`), missing ~half
   the tables. **Do not use it.** Introspect the live DB instead (`prisma db pull`).
2. **`telemarketer_access` vs `leads_access` discrepancy.** The leads RLS gates
   adviser access on `telemarketer_access`; the frontend `hasLeadsAccess()` uses
   the separate `leads_access` column. The backend mirrors the DB
   (`telemarketerAccess`) for now and flags it — pick one canonical flag.
3. **Backend bypasses RLS.** Connecting with a privileged role means RLS no
   longer protects anything — all of it must live in `*.authz.ts`. This is the
   top security risk of the migration.
