# Build Logs

## 2026-06-04, 05:50 PM — Fix lead status change: NOT NULL violation on lead_status_history.changed_by

**Root cause:** `updateLead` in `services/leads.ts` was sending a plain `supabase.from('leads').update(...)` call. The `fn_lead_status_side_effects` trigger fires on every status change and inserts into `lead_status_history` using `NULLIF(current_setting('app.crm_user_id', true), '')` for `changed_by`. Since the app never set that session variable, `changed_by` was always `NULL`, violating the NOT NULL constraint (PostgreSQL error 23502).

**Fix — DB (wav-db / Supabase):**
Migration `create_rpc_update_lead` — added `public.rpc_update_lead(p_id, p_payload, p_user_id)`. This function calls `set_config('app.crm_user_id', p_user_id, true)` and does the full UPDATE in the same PL/pgSQL block, so the trigger reads the correct user ID from the same transaction. Uses `jsonb_populate_record` for a clean partial-update merge (only keys present in `p_payload` overwrite existing values).

**Fix — App:**
- `src/services/leads.ts` — `updateLead` now accepts `userId: string` and calls `supabase.rpc('rpc_update_lead', ...)` instead of direct table update
- `src/hooks/useLeads.ts` — `useUpdateLead` mutation input extended with `userId: string`
- `src/pages/LeadsPage.tsx` — status action dropdown passes `userId: currentUser.id`
- `src/pages/LeadDetailPage.tsx` — all 3 `updateLeadMutation.mutate` calls (save form, appointment outcome, products toggle) pass `userId`
- `src/components/calling/CallOutcomeForm.tsx` — both `mutateAsync` calls (APPOINTMENT advance, contact ID backfill) pass `userId`
