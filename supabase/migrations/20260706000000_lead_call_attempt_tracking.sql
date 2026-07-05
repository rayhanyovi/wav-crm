-- WAV CRM — lead call attempt tracking and callback completion cleanup.
--
-- Adds explicit counters for call rotation / no-answer buckets. Existing rows
-- are backfilled from CALL activities so queues do not start from zero after the
-- migration is applied to a populated Supabase project.

alter table public.leads
  add column if not exists call_attempt_count integer not null default 0,
  add column if not exists no_answer_count integer not null default 0,
  add column if not exists last_call_attempt_at timestamptz,
  add column if not exists last_no_answer_at timestamptz;

with call_stats as (
  select
    lead_id,
    count(*) filter (where type = 'CALL')::integer as call_attempt_count,
    count(*) filter (where type = 'CALL' and result = 'NO_ANSWER')::integer as no_answer_count,
    max(coalesce(completed_at, scheduled_at, created_at)) filter (where type = 'CALL') as last_call_attempt_at,
    max(coalesce(completed_at, scheduled_at, created_at)) filter (where type = 'CALL' and result = 'NO_ANSWER') as last_no_answer_at
  from public.activities
  where lead_id is not null
    and deleted_at is null
  group by lead_id
)
update public.leads l
set
  call_attempt_count = greatest(coalesce(l.call_attempt_count, 0), call_stats.call_attempt_count),
  no_answer_count = greatest(coalesce(l.no_answer_count, 0), call_stats.no_answer_count),
  last_call_attempt_at = greatest(l.last_call_attempt_at, call_stats.last_call_attempt_at),
  last_no_answer_at = greatest(l.last_no_answer_at, call_stats.last_no_answer_at),
  last_contacted_at = greatest(l.last_contacted_at, call_stats.last_call_attempt_at)
from call_stats
where l.id = call_stats.lead_id;

update public.leads
set
  call_attempt_count = greatest(coalesce(call_attempt_count, 0), 1),
  last_call_attempt_at = coalesce(last_call_attempt_at, last_contacted_at)
where last_contacted_at is not null
  and call_attempt_count = 0;

update public.leads
set
  call_attempt_count = coalesce(call_attempt_count, 0),
  no_answer_count = coalesce(no_answer_count, 0);

create index if not exists leads_call_rotation_idx
  on public.leads (last_call_attempt_at asc nulls first, created_at desc)
  where deleted_at is null and is_abandoned = false;

create index if not exists leads_no_answer_bucket_idx
  on public.leads (no_answer_count, last_no_answer_at)
  where deleted_at is null and is_abandoned = false;
