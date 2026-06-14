-- ─────────────────────────────────────────────────────────────────────────────
-- WAV CRM — provision a crm_users row for every new Supabase Auth user.
--
-- Without this, a freshly signed-up auth user has no crm_users row, so the API's
-- requireAuth ("No CRM profile for this account") and the frontend loadSession
-- both reject them — they can never reach the onboarding/approval queue.
--
-- The new row starts in PENDING_PROFILE with no role and is_active = false. The
-- user then sets a password + name/requested role (POST /api/users/onboarding,
-- → PENDING_APPROVAL) and a MASTER approves them (POST /api/users/:id/approve,
-- → ACTIVE with a role).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crm_users (id, auth_user_id, email, name, role, is_active, account_status)
  values (
    new.id::text,
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New User'
    ),
    null,
    false,
    'PENDING_PROFILE'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any existing auth user that never got a crm_users row enters the
-- pending queue too (idempotent — does nothing once rows exist).
insert into public.crm_users (id, auth_user_id, email, name, role, is_active, account_status)
select
  u.id::text,
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'New User'
  ),
  null,
  false,
  'PENDING_PROFILE'
from auth.users u
left join public.crm_users c on c.auth_user_id = u.id
where c.id is null
on conflict (id) do nothing;
