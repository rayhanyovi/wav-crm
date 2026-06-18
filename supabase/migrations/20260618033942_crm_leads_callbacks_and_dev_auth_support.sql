-- WAV CRM — catch-up migration for callback routing, lead ownership/import
-- tracking, contact demographics, local-dev auth support, and call-session
-- persistence.
--
-- This file is intentionally idempotent. The live production database already
-- has several of these columns from live fixes. Keeping the migration in source
-- control makes future clones and reviews reproducible.

-- ── User/session support ────────────────────────────────────────────────────

alter table public.crm_users
  add column if not exists account_status text not null default 'ACTIVE',
  add column if not exists requested_role text,
  add column if not exists leads_access boolean not null default true,
  add column if not exists must_change_password boolean not null default false;

update public.crm_users
set
  account_status = coalesce(account_status, 'ACTIVE'),
  leads_access = coalesce(leads_access, true),
  must_change_password = coalesce(must_change_password, false);

create index if not exists crm_users_account_status_idx
  on public.crm_users (account_status);

-- ── Lead calling, duplicate handling, callback, and fact-find fields ─────────

alter table public.leads
  add column if not exists created_by text,
  add column if not exists telemarketer_owner_id text,
  add column if not exists adviser_owner_id text,
  add column if not exists bounce_count integer not null default 0,
  add column if not exists last_bounced_at timestamptz,
  add column if not exists converted_contact_id text,
  add column if not exists converted_at timestamptz,
  add column if not exists cooldown_until timestamptz,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists callback_at timestamptz,
  add column if not exists callback_assigned_to text,
  add column if not exists callback_note text,
  add column if not exists callback_notified boolean not null default false,
  add column if not exists financial_goal public.financial_goal,
  add column if not exists risk_tolerance public.risk_tolerance,
  add column if not exists investment_horizon public.investment_horizon,
  add column if not exists monthly_investable numeric,
  add column if not exists existing_investments text,
  add column if not exists fact_find_notes text,
  add column if not exists fact_find_done boolean;

update public.leads
set
  bounce_count = coalesce(bounce_count, 0),
  callback_notified = coalesce(callback_notified, false);

create index if not exists leads_created_by_idx
  on public.leads (created_by);

create index if not exists leads_telemarketer_owner_idx
  on public.leads (telemarketer_owner_id);

create index if not exists leads_adviser_owner_idx
  on public.leads (adviser_owner_id);

create index if not exists idx_leads_callback_at
  on public.leads (callback_at)
  where callback_at is not null and deleted_at is null;

drop index if exists public.leads_callback_due_idx;

create index if not exists leads_callback_assignee_idx
  on public.leads (callback_assigned_to)
  where callback_assigned_to is not null and deleted_at is null;

-- ── Contact demographics carried from lead conversion ───────────────────────

alter table public.contacts
  add column if not exists gender text,
  add column if not exists age integer,
  add column if not exists zipcode text,
  add column if not exists residential_status text,
  add column if not exists income_range text,
  add column if not exists preferred_contact_method text,
  add column if not exists best_time_to_call text,
  add column if not exists financial_goal public.financial_goal,
  add column if not exists risk_tolerance public.risk_tolerance,
  add column if not exists investment_horizon public.investment_horizon,
  add column if not exists monthly_investable numeric,
  add column if not exists existing_investments text,
  add column if not exists fact_find_notes text,
  add column if not exists fact_find_done boolean;

-- ── Call-session persistence ────────────────────────────────────────────────

create table if not exists public.call_sessions (
  id text primary key,
  user_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  total_duration_seconds integer not null default 0,
  calls_made integer not null default 0,
  pickups integer not null default 0,
  lead_ids text[] not null default '{}'
);

create index if not exists call_sessions_user_started_idx
  on public.call_sessions (user_id, started_at desc);

alter table public.call_sessions enable row level security;

drop policy if exists call_sessions_authenticated_select_own on public.call_sessions;
create policy call_sessions_authenticated_select_own
  on public.call_sessions
  for select
  to authenticated
  using (user_id = (select auth.uid())::text);

grant select on public.call_sessions to authenticated;

-- ── Script library table ────────────────────────────────────────────────────

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists scripts_created_by_idx
  on public.scripts (created_by);

alter table public.scripts enable row level security;

drop policy if exists scripts_authenticated_select on public.scripts;
drop policy if exists "All authenticated users can read scripts" on public.scripts;
create policy "All authenticated users can read scripts"
  on public.scripts
  for select
  to authenticated
  using (deleted_at is null);

drop policy if exists "MASTER can insert scripts" on public.scripts;
create policy "MASTER can insert scripts"
  on public.scripts
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.crm_users
      where auth_user_id = (select auth.uid())
        and role = 'MASTER'
    )
  );

drop policy if exists "MASTER can update scripts" on public.scripts;
create policy "MASTER can update scripts"
  on public.scripts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.crm_users
      where auth_user_id = (select auth.uid())
        and role = 'MASTER'
    )
  );

drop policy if exists "MASTER can delete scripts" on public.scripts;
create policy "MASTER can delete scripts"
  on public.scripts
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.crm_users
      where auth_user_id = (select auth.uid())
        and role = 'MASTER'
    )
  );

grant select on public.scripts to authenticated;
