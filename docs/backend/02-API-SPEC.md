# 02 — API Specification

Base path `/api`. All endpoints require `Authorization: Bearer <supabase-jwt>`
unless noted. Responses use the envelope `{ data: ... }` for success and
`{ error: { code, message, details?, requestId } }` for failures. List endpoints
return `{ data: [], total, page, pageSize }`.

Conventions: `GET` list/read, `POST` create, `PATCH` partial update, `DELETE`
soft-delete. IDs are text (matches the DB). Pagination via `?page=&pageSize=`.

> ✅ = built in the reference slice. Everything else is a todo (see 05-TODOS.md),
> specced here so agents implement consistently.

## Auth & session

| Method | Path | Maps from | Notes |
|--------|------|-----------|-------|
| GET | `/api/me` | `getSession` + crm_users lookup | Returns the resolved `actor`. |
| POST | `/api/onboarding/complete` | `complete_onboarding` | Body `{ name, requested_role }`. |
| POST | `/api/admin/users/:id/approve` | `approve_user` | MASTER only. Body `{ role }`. |
| POST | `/api/admin/users/:id/reject` | `reject_user` | MASTER only. |
| POST | `/api/admin/activate-super-admin` | `activate_super_admin` | Pre-configured master only. |

> Login/magic-link stays on Supabase Auth in Phase 1 (frontend → Supabase
> directly). The backend only **verifies** the resulting token.

## Leads ✅ (reference slice)

| Method | Path | Status | Authz |
|--------|------|--------|-------|
| GET | `/api/leads` ✅ | 200 | pool access (MASTER/TM/adviser w/ tm-access) |
| GET | `/api/leads/:id` ✅ | 200 / 404 | pool access |
| POST | `/api/leads` ✅ | 201 | any authenticated role |
| PATCH | `/api/leads/:id` ✅ | 200 / 404 | pool access; ports `rpc_update_lead` + status side-effects |
| DELETE | `/api/leads/:id` ✅ | 204 | MASTER or assigned/adviser owner (soft delete) |
| POST | `/api/leads/:id/claim` | 200 | adviser; `claim_lead` (credit ledger) |
| POST | `/api/leads/:id/return` | 200 | owner; `return_lead` |
| POST | `/api/leads/:id/convert` | 201 | `convert_lead` → `{ contact_id, deal_id }` |
| POST | `/api/leads/claim-for-call` | 200 | TM/cold-caller; batch claim pool (`claimLeadsForCall`) |
| GET | `/api/leads/:id/notes` · POST · DELETE | | `lead_notes` |
| GET | `/api/leads/:id/status-history` | 200 | `lead_status_history` |

Query params for `GET /api/leads`: `status`, `source`, `search`, `includeAbandoned`,
`page`, `pageSize`.

## Deals

| Method | Path | Authz / notes |
|--------|------|---------------|
| GET | `/api/deals` | role-scoped list |
| GET | `/api/deals/:id` | owner/master/assigned-TM |
| POST | `/api/deals` | adviser/master |
| PATCH | `/api/deals/:id` | **MASTER or assigned owner only** (the `42501` fix) |
| POST | `/api/deals/:id/stage` | move stage; writes `stage_history` + notifications |
| POST | `/api/deals/:id/claim` | claim released deal (credit) |
| POST | `/api/deals/:id/release` | `release_deal` |
| GET/POST/PATCH/DELETE | `/api/deals/:id/proposals[/:lineId]` | `deal_proposals` + `deal_proposal_lines` |

## Contacts · Activities · Notifications · Comments

| Resource | Endpoints |
|----------|-----------|
| Contacts | `GET/POST /api/contacts`, `GET/PATCH /api/contacts/:id`, `*/notes` |
| Activities | `GET/POST /api/activities`, `GET /api/activities/:id`; filter by `lead_id`/`deal_id`/`contact_id`/`type`/`scheduled` |
| Notifications | `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` |
| Comments | `GET/POST /api/comments?entityType=&entityId=`, `DELETE /api/comments/:id` |
| Call sessions | `POST /api/call-sessions` (telemetry on session end) |

## Catalog (read-mostly)

| Resource | Endpoints |
|----------|-----------|
| Products/Bundles | `GET /api/products`, `GET /api/bundles` |
| SGA funds | `GET /api/funds` (paginated/searchable; 2,195 rows) |
| Users (team) | `GET /api/users` (active team), `PATCH /api/users/:id` (MASTER: role/credit/access) |
| Audit logs | `GET /api/audit-logs` (MASTER; append-only) |

## Standard status codes

`200` ok · `201` created · `204` deleted · `400` bad request · `401`
unauthenticated · `403` forbidden · `404` not found · `409` conflict · `422`
validation · `500` internal.
