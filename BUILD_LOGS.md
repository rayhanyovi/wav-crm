# BUILD LOGS

Entries are newest-first. Always prepend — do not append.

## 2026-06-18 — Production duplicate leads merged by phone

- Ran the production duplicate-lead merge batch using phone digits as the grouping key and the app's true merge service, not random deletion.
- Applied result: 145 duplicate phone groups merged into 145 kept leads; active leads are now 717, duplicate phone groups are 0, and rows in duplicate groups are 0.
- Preservation check: 9 groups had a worked/touched lead and those touched rows were the merge targets; all 145 merged-away source rows had touch score 0. The merge service carries missing fields forward, moves linked lead records, writes merge notes/audit logs, and only then soft-deletes the duplicate source.
- Verified production audit artifacts: 145 recent soft-deleted source leads, 145 merge notes, 145 lead DELETE audit rows, and 145 lead UPDATE audit rows. Apply report: `tmp/lead-merge-plan-20260618-041121.csv`.

## 2026-06-18 — Live duplicate leads audit

- Ran a read-only duplicate-lead audit against the active Supabase profile using phone digits as the grouping key.
- Result: 862 active leads, 145 duplicate phone groups, 290 rows in duplicate groups, 145 soft-delete candidates, 0 groups requiring manual review for multiple worked rows.
- No production lead data was changed. The generated CSV report is under ignored `tmp/` and the current cleanup script remains dry-run-first.

## 2026-06-18 — Production migration applied

- Added and applied an idempotent Supabase migration: `20260618033942_crm_leads_callbacks_and_dev_auth_support.sql`.
- The migration records callback routing, lead ownership/import tracking, contact demographics, dev-auth support columns, `call_sessions`, and `scripts` table support in source control. Live production already had the target app columns; the migration ran safely as a catch-up/no-op for those and cleaned up policy/index drift.
- Fixed Supabase advisor warnings introduced by duplicate callback indexes and RLS policy shapes; `supabase db advisors --db-url "$DIRECT_URL" --fail-on none` now reports no issues.
- Verified production schema targets via `information_schema` and ran a Supabase-profile production build.

## 2026-06-18 — Production readiness check before push

- Checked current workspace for commit/push readiness after the bulk Call change.
- Verified still passing: `npm run test:coverage` (client 54 tests / server 254 tests), plus prior `npm run build` and Docker `npm run test:e2e`.
- Found deployment caveats: `npm run lint` currently fails because lint scans generated Prisma client and coverage reports, plus existing source lint debt; production audit still has the known `xlsx` high-severity advisory with no fix available.
- Recommendation: safe to commit and push to a branch/PR, but avoid direct production deployment until lint/CI expectations and production DB/environment assumptions are confirmed.

## 2026-06-18 — Bulk-selected leads can start a call session

- Replaced the Leads bulk-action Merge button with a `Call` action. Selected leads now become the exact call-session queue in the current filtered/sorted order, so users can choose leads first and then start calling them directly.
- Kept duplicate merge available at the data/API/component level, but removed the bulk-table entry point for now per request.
- Updated Docker E2E coverage: the critical flow now selects two leads, verifies Merge is hidden, clicks Call, and confirms the Calling Session opens with `Lead 1 of 2`.
- Verified: `npm run build` and `npm run test:e2e`.

## 2026-06-18 — Test coverage hardening + Docker e2e verification

- Verified Codex's test setup: client coverage scoped to 4 pure-logic files, server coverage to the 3 leads files (authz/service/sideEffects), both at 90% line/stmt/func thresholds (branches 75 server / 90 client). Coverage already passed; this pass closed edge-case gaps.
- Added edge-case unit tests:
  - **leads.authz**: the untested ADVISER branch of `canUpdateLead` (leads-access vs owned-only) + deny-by-default for an unrecognised role → `leads.authz.ts` now **100% lines / 98% branch** (was 87%).
  - **leads.service** (`updateLead`): scheduling a callback writes a `Date` and resets `callbackNotified`; clearing with `null` nulls it — covers the `toPrismaUpdate` callback branch.
  - **leads.sideEffects**: generic-name fallback + no-appointment-date message branch, no-LEAD_BOUNCED-without-prev-TM, and `recordStatusNote` (known change, unchanged skip, unmapped-status fallback both sides) → **100% lines / 95% branch**.
  - **notifications**: `sweepDueCallbacks` emits `CALLBACK_DUE` and marks leads notified (protects the lazy-sweep feature).
- **Final**: server **176 tests / 93.5% lines / 84.7% branch**, client **38 tests / 100% lines / 97% branch**, `test:coverage` exit 0.
- **Docker e2e**: ran `playwright test` against local Docker Postgres (dev-auth profile) — **4/4 pass** (dev-auth dashboard, bulk merge keeps worked dup + moves notes, callback assign-to-other-TM, "Uploaded by me" calling filter). Confirmed the local DB has the callback + contact-demographic columns from this session's migrations.
- Note: did not touch app code — Codex had already implemented merge, the callback assignee picker, the "Uploaded by me" filter, and dev auth. Remaining uncovered are diminishing-returns micro-branches in `leads.service.ts` (claimForCall region 509-527, convert adviser-credit 627-628) and one nullish branch; all metrics are comfortably past threshold. Coverage scope is intentionally the core leads logic — broadening to every module would be a separate, larger effort.

## 2026-06-18 — Broadened test coverage scope (server-wide + client logic)

- **Server coverage scope** ([vitest.server.config.ts](vitest.server.config.ts)) broadened from the 3 leads files to **all module business logic** (`server/modules/**/*.{service,authz,sideEffects}.ts`), excluding 4 trivial 2-line re-export stubs. Thin glue (controllers/routes/schema) stays out — it's exercised by `app.routes.test.ts` + e2e.
- Wrote tests to fill every gap: **deals** proposals/lines/stage-history + SUBMITTED/WON branches; **contacts** updateContact/notes/search; **activities** update/softDelete/getComments; **users** full patch + onboarding/approval/super-admin flow; **call-sessions** (new file, service+authz); **scripts** (new file, full CRUD); **catalog** products/bundles + empty-meta; tiny **catalog.authz** & **notifications.authz** files; plus deny-by-default edge tests across leads/deals/contacts authz.
- Result: server **77% → 97.15% lines / 84.5% branch / 99.2% funcs**, **254 tests** (was 176).
- **Client coverage scope** ([vitest.config.ts](vitest.config.ts)) broadened with 3 pure-logic helpers (`format`, `selectors`, `factFind`) + new tests. UI/network/store-coupled code (components, pages, api/supabase, zustand stores, thin service mappers) intentionally stays in e2e scope.
- Result: client **99.65% lines / 98.6% branch / 100% funcs**, **54 tests** (was 38).
- `npm run test:coverage` exits 0 (all 90% line/stmt/func thresholds met). Docker e2e re-confirmed **4/4** (no app code changed — tests + config only).
- Note: a couple of low-value branches remain uncovered and below per-file ideal but above the suite thresholds — `leads.service.ts` claimForCall/convert credit branches, a few nullish guards. Broadening further into UI/network code would be low-value churn.

## 2026-06-23 — CallSheet Dialer Tools trimmed

- Reduced CallSheet Toolkit/Dialer Tools to only the requested lead fields: primary number, email, positioning cue, age, first name, last name, gender, income range, and postal code.
- Removed the over-broad Lead Properties display so internal lead metadata no longer appears in the calling panel.
- Verified with `npm run build`.

## 2026-06-23 — CallSheet Dialer Tools lead properties expanded

- Added a full Lead Properties section to CallSheet Dialer Tools so callers can see the lead's identity, contact, profile, status, appointment, callback, fact-find, ownership, lifecycle, and record metadata from the Toolkit tab.
- Completed the frontend lead mapper for previously omitted lead fields including personality, preferred contact method, best time to call, appointment result, products discussed, last bounced/cooldown timestamps, and related lifecycle properties.
- Verified `npm run build` and `npm run typecheck:server` pass; Vite was already running on `http://localhost:5173`.

## 2026-06-23 — Lead demographic update mapping fixed

- Verified live Supabase Jeewan leads from `/Users/rayhan/Downloads/Jeewan - 150 leads 17_6_26.xlsx`: all 150 active leads have `age` and `zipcode`, with 0 missing ages, 0 missing postal codes, and 0 active duplicate phone groups.
- Found the Excel itself has 50 rows where `Postcode` is blank but a 6-digit postal code appears under `Date of Birth`; the DB still has postal codes for all 150 because overlapping rows kept the prior zipcode data.
- Fixed `updateLead` so edits persist `residential_status`, `income_range`, and `zipcode`, and added a regression test for those fields.

## 2026-06-23 — Jeewan 150-lead cleanup corrected

- Replaced the mistaken Jeewan 3,000-lead import with the actual `/Users/rayhan/Downloads/Jeewan - 150 leads 17_6_26.xlsx` source of truth in live Supabase.
- Inserted 100 missing Jeewan leads, updated 50 untouched overlapping leads with Excel fields, and soft-deleted 2,950 untouched Jeewan-attached leads that were not in the 150-lead file; no leads attached to other advisers were targeted.
- Verified Jeewan now has 150 active attached leads, 150 distinct Excel phones present, 0 missing Excel phones, 0 active non-file Jeewan leads, and 0 active duplicate phone groups.

## 2026-06-22 — Staging registration email policy

- Added `VITE_REGISTRATION_EMAIL_POLICY` with production-safe default behavior: omitted/`company` keeps registration restricted to `@sg-alliance.com` plus explicit test allowlist, while `any` lets staging accept any syntactically valid email.
- Updated the register page copy, placeholder, and validation to reflect the active policy so staging no longer shows the SG Alliance-only message.
- Documented the env var in `.env.local.example` and deployment docs.
- Verified: `npm run test -- src/lib/auth-domain.test.ts` and `npm run build`.

## 2026-06-22 — Jeewan Excel lead cleanliness verified

- Re-audited live Supabase against `/Users/rayhan/Downloads/2026-02-10 - WAV_Dwayne - 3000 leads.xlsx` using normalized phone digits as the key.
- Verified active state: Jeewan has exactly 3,000 active leads from the Excel file, all 3,000 are both `created_by` and `assigned_to_id` Jeewan, with 3,000 distinct active phones, 0 missing Excel phones, 0 duplicate active phone groups, and 0 active Jeewan rows outside the file.
- Verified cross-creator state: the Excel phone set has 3,000 active rows across all creators and 3,000 distinct phones, so no active duplicate exists elsewhere for those phones.
- Noted historical debris only: 1,050 Jeewan rows remain soft-deleted from prior failed attempts, plus 1,050 notifications tied to those deleted lead IDs; these were not hard-deleted.

## 2026-06-22 — Jeewan lead import and reminder-only notifications

- Imported the 3,000-row Excel lead file into live Supabase as active leads created/assigned to Jeewan Singh; verification found 3,000 active matching phone keys, all `NA` / `AP_MARKETING`, with 3,000 `CREATE` audit rows and no notifications created for the import.
- Muted lead/deal transition notifications in server side effects, including `LEAD_ASSIGNED`, `LEAD_BOUNCED`, `APPOINTMENT_SET`, and `DEAL_STAGE_CHANGED`.
- Limited the notification feed to reminder types only and added lazy `APPOINTMENT_TODAY` / `CALLBACK_TODAY` sweeps while preserving existing `CALLBACK_DUE`; the optional 2-hour pre-reminder is not implemented yet.
- Verified targeted notification/side-effect tests and server typecheck pass; full server suite still has unrelated `listLeads` expectation failures in `server/modules/leads/leads.service.test.ts`.

## 2026-06-21 — Live Jeewan lead upload audit

- Audited live Supabase data against `/Users/rayhan/Downloads/2026-02-10 - WAV_Dwayne - 3000 leads.xlsx`.
- The Excel file has 3,000 valid rows with 3,000 unique phone keys, but Jeewan has 0 active leads from the file in production; only 50 file phones ever matched Jeewan rows, and those 410 rows are soft-deleted.
- Found Jeewan created/deleted 1,050 lead rows on 2026-06-21 Jakarta time across 150 unique phones, leaving 1,050 unread `LEAD_ASSIGNED` notifications attached to deleted lead IDs; no DB cleanup or re-import was performed in this pass.

## 2026-06-28 — Dashboard dialer time updates from call outcomes

- Fixed call outcome duration persistence by sending activity `metadata` from the client and accepting/storing it through the activities API.
- Updated dashboard call stats to read today's per-call `duration_seconds` metadata, with saved call sessions as a fallback/aggregate guard, so Time on Dialer updates after completed calls.
- Wired the client call-session list service to the existing API endpoint and added regression coverage for selector duration logic and activity metadata persistence.

## 2026-06-28 — Appointment time entry and call queue rotation

- Replaced segmented native time inputs in appointment/follow-up flows with a reusable text time input that accepts values like `4:30 pm`, `430pm`, `4pm`, and `16:30` while storing canonical `HH:mm`.
- Updated CALL activity logging to stamp the lead's `lastContactedAt`, invalidated lead caches after call logs, and sorted start-calling queues so recently attempted leads move behind untouched or older-attempted leads.
- Added parser and activity-service regression tests; verified targeted tests, client build, and server typecheck.

## 2026-07-06 — Callback cleanup and no-answer queue rotation

- Added lead call-attempt tracking (`call_attempt_count`, `no_answer_count`, `last_call_attempt_at`, `last_no_answer_at`) with an idempotent Supabase migration that backfills from CALL activities.
- Updated CALL activity side effects to increment attempt counters, stamp timestamps, and clear stale callback fields; KIV follow-up outcomes now reschedule callback time instead of leaving the old due callback in place.
- Reworked callback scheduling UX to separate date + time inputs with quick presets, and added no-answer bucket filters/badges plus oldest-attempt queue ordering.
- Verified targeted server tests, server typecheck, and production build. Repo-wide lint still fails on pre-existing generated/coverage/source lint debt. Live `wav-db-new` migration was not applied because the workspace does not expose a verifiable `wav-db-new` Supabase target/CLI.

<!-- NEW ENTRIES GO HERE -->

## 2026-06-18 — 90% coverage gates + Docker E2E smoke

- Added explicit coverage scripts and thresholds: client coverage targets shared auth/permission/user-service modules at 90%+, and server coverage targets the Leads auth/service/side-effect layer at 90% statements/lines/functions with a pragmatic branch threshold for the larger service.
- Added Playwright E2E coverage for the Docker dev environment: dev auth login, true duplicate merge preserving the worked lead, callback assignment to another telemarketer, and Start Calling's "Uploaded by me" pool.
- Fixed a real deep-link bug found by E2E: protected routes now wait for `authReady` before redirecting, so `/leads` no longer bounces through login back to the Dashboard while dev/Supabase session loading is still in flight.
- Added focused unit coverage for permission predicates, user-service API mapping/mutations, and Leads authz flows that matter to calling, conversion, and duplicate handling.
- Verified: `npm run test:coverage`, `npm run test:e2e` against Docker profile, and `npm run build`. Production audit still reports the existing `xlsx` high-severity advisory with no fix available.

## 2026-06-18 — Callback assignee picker + true duplicate merge

- Added a callback assignee picker in [CallbackModal.tsx](src/components/leads/CallbackModal.tsx) so callbacks can be routed to a specific active telemarketer; due boards and Start Calling queues now only surface assigned callbacks to the assigned user (Master can still see all).
- Added true lead duplicate merge by phone: [MergeDuplicatesDialog.tsx](src/components/leads/MergeDuplicatesDialog.tsx) lets users keep one selected lead, while [leads.service.ts](server/modules/leads/leads.service.ts) moves notes, status history, activities, deals, credit transactions, and lead notifications onto the kept lead before soft-deleting duplicate rows. Server enforces same digits-only phone key and ownership/update permissions.
- Fixed the Docker clone path for the local dev environment: local/client Postgres now use `postgres:17-alpine`, `pg_restore` targets the local DB explicitly, and the clone script creates lightweight Supabase-compatible roles/functions needed to restore RLS policies.
- Verified in Docker profile against a fresh clone of Supabase data: focused merge tests, full server suite, client suite, production build, route-level appointment/status/callback smoke, and local DB merge smoke.

## 2026-06-18 — Targeted calling: per-row Call button + filtered Start Calling

- **Single-lead Call button** on the Leads table ([LeadsPage.tsx](src/pages/LeadsPage.tsx)) for cold-callers (Master/TM/Adviser-with-leads). Best-effort soft-locks the lead, then opens a one-lead calling session — no need to pull a full session.
- **Filtered Start Calling sessions** ([StartCallingModal.tsx](src/components/calling/StartCallingModal.tsx)): collapsible filter panel for gender, age range, postal-code prefix, source, income range, residential status. Options are built from distinct values actually present in the pool. Filters apply to the full eligible pool before slicing to the session cap; shows "X of Y match".
- **Fixed claim-decoupling bug**: `claimForCall` ignored the lead IDs the client sent and grabbed the oldest N pooled leads, so the queue shown ≠ the queue locked. Extended `claimForCallSchema` + service to accept `leadIds` and lock exactly those when provided ([leads.schema.ts](server/modules/leads/leads.schema.ts), [leads.service.ts](server/modules/leads/leads.service.ts), [leads.ts](src/services/leads.ts)). Falls back to count-based pooling when omitted.
- **Why**: user wanted to (a) call a specific person ad-hoc and (b) target cold-call sessions by category (e.g. only women, a specific zipcode) instead of random pull.
- Verified: client + server typecheck clean; dev bundle loads with no console errors. Interactive flow not exercised (needs auth + backend).
- **Follow-ups (planned, not done)**: import dedup by phone; bulk select + bulk actions; Contact fact-find fields carried on convert (needs migration); callback-at-2PM feature with Due-Today board + notifications (needs migration).

## 2026-06-18 — Contact fact-find demographics carried on convert (+ live migration)

- **Live migration** on Supabase project `kkfzbgbbjijdhlolkwux`: added nullable columns to `contacts` — `gender`, `age`, `zipcode`, `residential_status`, `income_range`, `preferred_contact_method`, `best_time_to_call` (migration `add_demographics_to_contacts`). Backfill from originating leads ran (0 rows — source leads had no demographics either).
- **Convert now carries demographics** from lead → contact ([leads.service.ts](server/modules/leads/leads.service.ts) `convertLead`), so the Contact fact-find is no longer blank after conversion. Previously these columns didn't exist on `contacts`, so the data was dropped.
- Plumbed through all layers: Prisma `Contact` model, regenerated client, `Contact` type ([types.ts](src/data/types.ts)), `ApiContact`/`mapContact` ([contacts.ts](src/services/contacts.ts)), and a demographics block in the Contact Information card ([ContactDetailPage.tsx](src/pages/ContactDetailPage.tsx), read view, only renders fields that have a value).
- **Why**: user reported the Contact fact-find was missing Gender / Postal code / Age after a lead converts.
- Verified: client + server typecheck clean; server suite 153 pass (3 pre-existing failures in `leads.service.test.ts` from a missing `leadNote` mock — confirmed unrelated via stash test, flagged as a separate task); dev bundle loads with no console errors.

## 2026-06-18 — Import dedup by phone

- [LeadImportDialog.tsx](src/components/leads/LeadImportDialog.tsx): detects duplicate leads by phone — both within the pasted/uploaded file and against existing leads in the system (digits-only matching via `phoneKey`). Shows "X will import · Y duplicates skipped", duplicates are marked in the preview, and a one-click toggle flips between skip/keep. Defaults to **skip**. Success screen reports how many duplicates were skipped.
- **Why**: users were accidentally importing the same sheet twice, creating indistinguishable duplicate leads.
- Note: dedup checks against the client-cached lead list (react-query, up to 500, role-scoped). Fine at current scale; a server-side phone-uniqueness check would be the robust long-term guard.
- Verified: client typecheck clean; dev bundle loads with no console errors.

## 2026-06-18 — Scheduled callbacks ("call me back at 2PM") + live migration

- **Live migration** on `kkfzbgbbjijdhlolkwux` (`add_callback_scheduling_to_leads`): added `callback_at timestamptz`, `callback_assigned_to text`, `callback_note text`, `callback_notified boolean default false` to `leads`, plus a partial index on `callback_at`.
- **Schedule action**: a "Schedule callback" item in the Leads row action menu opens a new [CallbackModal](src/components/leads/CallbackModal.tsx) — datetime picker with quick presets (In 1 hour / Today 2 PM / Today 5 PM / Tomorrow 10 AM), optional note, and a Clear option. Writes via the lead PATCH ([leads.schema.ts](server/modules/leads/leads.schema.ts), `toPrismaUpdate` — rescheduling resets `callbackNotified`).
- **Due board** on [LeadsPage](src/pages/LeadsPage.tsx): a highlighted "Callbacks due" panel listing due + today's callbacks (overdue → red "Due now"), each with a one-click Call button; click a row to reschedule. "+N scheduled for later" footer.
- **Queue injection**: due callbacks jump to the **front** of the Start Calling pool ([StartCallingModal](src/components/calling/StartCallingModal.tsx) `eligiblePool`), tagged "📞 callback due" in the session preview.
- **Notifications**: a lazy `CALLBACK_DUE` sweep in [notifications.service.ts](server/modules/notifications/notifications.service.ts) `listNotifications` — when a user polls the bell, any of their due-and-unnotified callbacks emit a notification and are marked notified. No cron needed; idempotent.
- **Why**: telemarketers needed to capture "call me back at 2PM" requests and have them resurface with urgency (board + bell + queue), optionally routed to a specific TM (`callback_assigned_to`, currently defaults to whoever scheduled it).
- Verified: client + server typecheck clean; server suite 153 pass (same 3 pre-existing `leadNote`-mock failures, flagged separately); fixed a regression I introduced in `notifications.service.test.ts` (sweep needed a `lead.findMany` stub); sweep query validated against the live schema; dev bundle loads with no console errors.
- **Deferred**: choosing a *different* TM for the callback (assignee picker) — defaults to self for now; `callback_assigned_to` already supports it at the data layer.

## 2026-06-18 — Bulk select + actions on Leads table

- [LeadsPage](src/pages/LeadsPage.tsx): checkbox column + header select-all (selects the whole filtered set, across pages), selected-row highlight, and a bulk action bar showing the count with **Set status** (dropdown) and **Delete** (with a confirm dialog) + Clear. Selection clears on filter/search change.
- Bulk ops run client-side over the existing per-lead endpoints via two new hooks ([useLeads.ts](src/hooks/useLeads.ts) `useBulkDeleteLeads`, `useBulkUpdateLeadStatus`) using `Promise.allSettled` — reuses the proven authz + side-effects of single-lead delete/PATCH, and reports partial failures (e.g. "Deleted 8; 2 couldn't be deleted").
- **Authz change**: extended `canDeleteLead` ([leads.authz.ts](server/modules/leads/leads.authz.ts)) to also allow the **telemarketer owner** to delete leads in their own queue — required so a TM can clean up their own accidental duplicate imports (previously only MASTER / assigned-adviser / adviser-owner could). Backward-compatible (telemarketerOwnerId optional); added an authz test.
- **Why**: users uploaded the same leads twice and had no way to multi-select and remove duplicates.
- Also fixed a pre-existing broken test inline: `leads.service.test.ts` mock was missing a `leadNote.create` stub (needed since the status-change auto-log feature) — added it; suite is now fully green.
- Verified: **client 29/29, server 157/157, typecheck clean**; dev bundle loads with no console errors.
- Note: true "merge duplicates" (keep one, fold notes/deals from the rest) was not built — selecting the dupes and deleting is the cleanup path for now.

## 2026-06-18 — Lead duplicate cleanup dry-run by phone

- Added [scripts/dedupe-leads-by-phone.mjs](scripts/dedupe-leads-by-phone.mjs), a dry-run-first maintenance script that groups active leads by digits-only phone number and classifies duplicate rows as keep, soft-delete candidate, or manual-review keep.
- The safety rule preserves worked leads using status/history/notes/activities/deals/conversion/callback/fact-find/update/audit signals; untouched duplicate rows are candidates, and all-untouched groups keep the oldest row deterministically.
- Added npm shortcuts: `leads:dedupe:dry` for report-only runs and `leads:dedupe:apply` for explicit soft-delete application with audit-log rows; generated CSV reports go under ignored `tmp/`.
- Live dry-run result: 862 active leads, 145 duplicate phone groups, 290 duplicate-group rows, 145 soft-delete candidates, 0 groups requiring multiple-worked-row manual review. No data was changed.

## 2026-06-18 — Start Calling can target uploaded leads

- [StartCallingModal.tsx](src/components/calling/StartCallingModal.tsx): added a visible `Lead set` selector for cold-call sessions with `All workable leads` and `Uploaded by me`, using the existing `leads.created_by` marker so a TM like Mark can start a session from leads they inserted/uploaded.
- The Start Calling preview now labels uploaded-by-me rows, and the existing targeting filters still apply after the lead-set choice.
- [leads.service.ts](server/modules/leads/leads.service.ts): targeted `claimForCall` sessions now accept leads that are still open or already owned by the caller, so uploaded TM leads already sitting in that TM queue can be used in a targeted session.
- Added a focused server test covering caller-owned targeted sessions; no database migration was needed.
- Verified: `npm run test:server -- server/modules/leads/leads.phase2.test.ts`, `npm run test:server`, and `npm run build`.

## 2026-06-18 — Local Docker development environment

- Added a Docker Postgres profile via [docker-compose.local.yml](docker-compose.local.yml) and env profile switching through [scripts/select-env.mjs](scripts/select-env.mjs): `.env.local.supabase`, `.env.local.docker`, and active `.env.local` selected by `npm run env:supabase` / `npm run env:docker`.
- Added [scripts/clone-supabase-to-local.mjs](scripts/clone-supabase-to-local.mjs), which uses Dockerized Postgres client tools to dump live Supabase `public` schema/data and restore it into local Docker Postgres; snapshots live under ignored `.local-data/`.
- Added gated dev auth (`DEV_AUTH_ENABLED`, `VITE_DEV_AUTH_ENABLED`) with [devAuth.routes.ts](server/modules/dev-auth/devAuth.routes.ts), `x-dev-user-id` API support, and a Docker-mode login user picker in [LoginPage.tsx](src/pages/LoginPage.tsx). Supabase mode keeps normal Supabase Auth/JWT behavior.
- Documented the flow in [LOCAL_DOCKER_DEV.md](docs/LOCAL_DOCKER_DEV.md) and added npm scripts for env selection, Docker DB lifecycle, clone, and `dev:docker` / `dev:supabase`.
- Verified: `npm run env:init`, `npm run env:docker`, Docker-profile `npm run build`, `npm run env:supabase`, `npm run test:server`, script syntax checks, and focused `git diff --check`. Real `db:local:clone` could not complete because Docker daemon was not running.
