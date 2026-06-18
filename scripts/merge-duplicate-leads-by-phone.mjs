import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.server" });
dotenv.config({ path: ".env" });

const DEFAULT_MIN_PHONE_DIGITS = 6;

function parseArgs(argv) {
  const out = {
    apply: false,
    confirmProduction: false,
    actorId: process.env.DEDUPE_ACTOR_ID ?? "",
    minPhoneDigits: DEFAULT_MIN_PHONE_DIGITS,
    report: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") out.apply = true;
    else if (arg === "--confirm-production") out.confirmProduction = true;
    else if (arg === "--actor-id") out.actorId = argv[++i] ?? "";
    else if (arg === "--min-phone-digits") out.minPhoneDigits = Number(argv[++i]);
    else if (arg === "--report") out.report = argv[++i] ?? "";
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isInteger(out.minPhoneDigits) || out.minPhoneDigits < 1 || out.minPhoneDigits > 30) {
    throw new Error("--min-phone-digits must be an integer from 1 to 30");
  }
  if (out.apply && !out.confirmProduction) {
    throw new Error("Refusing to apply without --confirm-production");
  }
  return out;
}

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/merge-duplicate-leads-by-phone.mjs
  npx tsx scripts/merge-duplicate-leads-by-phone.mjs --apply --confirm-production

Options:
  --apply                 Merge duplicate groups. Default is dry-run.
  --confirm-production    Required together with --apply.
  --actor-id <id>         Audit-log user id. Defaults to DEDUPE_ACTOR_ID or first active MASTER.
  --min-phone-digits <n>  Ignore phone keys shorter than n digits. Default: ${DEFAULT_MIN_PHONE_DIGITS}.
  --report <path>         CSV output path. Default: tmp/lead-merge-plan-<timestamp>.csv.
`);
}

function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function csvCell(value) {
  if (value == null) return "";
  const text = Array.isArray(value) ? value.join("|") : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(filePath, rows) {
  const headers = [
    "phone_key",
    "group_size",
    "target_id",
    "target_name",
    "target_status",
    "target_touch_score",
    "target_touch_reasons",
    "source_ids",
    "source_names",
    "source_touch_scores",
    "reason",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ];

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function toInt(value) {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

function duplicateRowsSql(minPhoneDigits) {
  return `
with base as (
  select
    l.*,
    regexp_replace(coalesce(l.phone, ''), '\\D', '', 'g') as phone_key
  from public.leads l
  where l.deleted_at is null
), dup_base as (
  select *
  from base
  where length(phone_key) >= ${minPhoneDigits}
), dup_groups as (
  select phone_key, count(*)::int as group_size
  from dup_base
  group by phone_key
  having count(*) > 1
), scored as (
  select
    b.id as lead_id,
    b.phone_key,
    b.first_name,
    b.last_name,
    b.phone,
    b.status::text as status,
    b.source::text as source,
    b.created_by,
    b.assigned_to_id,
    b.telemarketer_owner_id,
    b.adviser_owner_id,
    b.created_at,
    b.updated_at,
    b.last_contacted_at,
    array_remove(array[
      case when b.status::text <> 'NA' then 'status_not_na' end,
      case when b.last_contacted_at is not null then 'last_contacted' end,
      case when b.converted_contact_id is not null or b.converted_at is not null then 'converted' end,
      case when b.appointment_date is not null or b.appointment_time is not null or b.appointment_result is not null then 'appointment' end,
      case when b.callback_at is not null or b.callback_note is not null then 'callback' end,
      case when b.fact_find_done is true or nullif(trim(coalesce(b.fact_find_notes, '')), '') is not null then 'fact_find' end,
      case when b.cooldown_until is not null or b.bounce_count > 0 or b.last_bounced_at is not null then 'cooldown_or_bounce' end,
      case when b.is_abandoned is true or b.abandoned_at is not null then 'abandoned' end,
      case when b.updated_at > b.created_at + interval '1 second' then 'updated_after_create' end,
      case when exists (select 1 from public.lead_status_history h where h.lead_id = b.id) then 'status_history' end,
      case when exists (select 1 from public.lead_notes n where n.lead_id = b.id) then 'lead_notes' end,
      case when exists (select 1 from public.activities a where a.lead_id = b.id and a.deleted_at is null) then 'activities' end,
      case when exists (select 1 from public.deals d where d.lead_id = b.id and d.deleted_at is null) then 'deals' end,
      case when exists (select 1 from public.credit_transactions c where c.lead_id = b.id) then 'credit_transactions' end,
      case when exists (
        select 1
        from public.audit_logs al
        where al.entity_type = 'leads'
          and al.entity_id = b.id
          and al.action::text <> 'CREATE'
      ) then 'audit_non_create' end
    ], null) as touch_reasons
  from dup_base b
  join dup_groups g using (phone_key)
), ranked as (
  select
    s.*,
    cardinality(s.touch_reasons)::int as touch_score,
    count(*) over (partition by phone_key)::int as group_size,
    sum(case when cardinality(s.touch_reasons) > 0 then 1 else 0 end) over (partition by phone_key)::int as touched_in_group,
    row_number() over (partition by phone_key order by created_at asc, lead_id asc)::int as oldest_rank
  from scored s
), classified as (
  select
    *,
    case
      when touched_in_group > 0 and touch_score = 0 then true
      when touched_in_group = 0 and oldest_rank > 1 then true
      else false
    end as source_candidate,
    case
      when touched_in_group > 0 and touch_score = 0 then 'keep_worked_merge_untouched'
      when touched_in_group = 0 and oldest_rank > 1 then 'all_untouched_keep_oldest'
      when touched_in_group = 0 and oldest_rank = 1 then 'oldest_untouched_target'
      when touched_in_group > 1 then 'manual_review_multiple_worked'
      else 'worked_target'
    end as reason
  from ranked
)
select *
from classified
order by phone_key, source_candidate asc, touch_score desc, created_at asc, lead_id asc;
`;
}

async function loadDuplicateRows(prisma, minPhoneDigits) {
  return prisma.$queryRawUnsafe(duplicateRowsSql(minPhoneDigits));
}

function nameOf(row) {
  return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.lead_id;
}

function buildPlan(rows) {
  const byPhone = new Map();
  for (const row of rows) {
    const group = byPhone.get(row.phone_key) ?? [];
    group.push(row);
    byPhone.set(row.phone_key, group);
  }

  const plan = [];
  const manualReview = [];

  for (const [phoneKey, group] of byPhone.entries()) {
    const sources = group.filter((row) => row.source_candidate);
    const targets = group.filter((row) => !row.source_candidate);

    if (sources.length === 0 || targets.length !== 1 || targets[0].reason === "manual_review_multiple_worked") {
      manualReview.push({ phoneKey, targets, sources, group });
      continue;
    }

    const target = targets[0];
    plan.push({
      phone_key: phoneKey,
      group_size: toInt(target.group_size),
      target_id: target.lead_id,
      target_name: nameOf(target),
      target_status: target.status,
      target_touch_score: toInt(target.touch_score),
      target_touch_reasons: target.touch_reasons ?? [],
      source_ids: sources.map((source) => source.lead_id),
      source_names: sources.map(nameOf),
      source_touch_scores: sources.map((source) => toInt(source.touch_score)),
      reason: target.reason,
    });
  }

  return { plan, manualReview };
}

async function firstMasterActor(prisma, actorId) {
  const where = actorId ? { id: actorId } : { role: "MASTER", isActive: true };
  const user = await prisma.crmUser.findFirst({ where, orderBy: { createdAt: "asc" } });
  if (!user) throw new Error(actorId ? `No crm_users row found for --actor-id ${actorId}` : "No active MASTER user found");
  if (user.role !== "MASTER" || !user.isActive) {
    throw new Error(`Maintenance actor must be an active MASTER, got ${user.role ?? "no role"}`);
  }
  return {
    id: user.id,
    authUserId: user.authUserId ? String(user.authUserId) : `maintenance:${user.id}`,
    email: user.email,
    role: "MASTER",
    isActive: user.isActive,
    creditBalance: user.creditBalance,
    telemarketerAccess: user.telemarketerAccess,
    telemarketerId: user.telemarketerId,
    leadsAccess: user.leadsAccess,
    delegatedAdviserIds: [],
  };
}

async function activeDuplicateSummary(prisma, minPhoneDigits) {
  const rows = await prisma.$queryRawUnsafe(`
    with keyed as (
      select regexp_replace(coalesce(phone, ''), '\\D', '', 'g') as phone_key
      from public.leads
      where deleted_at is null
    )
    select
      count(*)::int as duplicate_groups,
      coalesce(sum(group_size), 0)::int as duplicate_rows
    from (
      select phone_key, count(*)::int as group_size
      from keyed
      where length(phone_key) >= ${minPhoneDigits}
      group by phone_key
      having count(*) > 1
    ) groups
  `);
  return {
    duplicateGroups: toInt(rows[0]?.duplicate_groups),
    duplicateRows: toInt(rows[0]?.duplicate_rows),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { prisma } = await import("../server/lib/prisma.ts");
  const { mergeDuplicateLeads } = await import("../server/modules/leads/leads.service.ts");

  try {
    const before = await activeDuplicateSummary(prisma, args.minPhoneDigits);
    const rows = await loadDuplicateRows(prisma, args.minPhoneDigits);
    const { plan, manualReview } = buildPlan(rows);
    const reportPath = path.resolve(args.report || `tmp/lead-merge-plan-${nowStamp()}.csv`);
    writeCsv(reportPath, plan);

    console.log(`Mode: ${args.apply ? "apply" : "dry-run"}`);
    console.log(`Duplicate phone groups before: ${before.duplicateGroups}`);
    console.log(`Rows in duplicate groups before: ${before.duplicateRows}`);
    console.log(`Planned merge groups: ${plan.length}`);
    console.log(`Planned source leads to merge away: ${plan.reduce((sum, row) => sum + row.source_ids.length, 0)}`);
    console.log(`Manual-review groups: ${manualReview.length}`);
    console.log(`Report: ${reportPath}`);

    if (manualReview.length > 0) {
      throw new Error("Refusing to apply while manual-review groups exist");
    }

    if (!args.apply) {
      console.log("No data changed.");
      return;
    }

    const actor = await firstMasterActor(prisma, args.actorId);
    let mergedGroups = 0;
    let mergedSources = 0;
    let moved = {
      notes: 0,
      statusHistory: 0,
      activities: 0,
      deals: 0,
      creditTransactions: 0,
      notifications: 0,
    };

    for (const row of plan) {
      const result = await mergeDuplicateLeads(actor, row.target_id, { source_ids: row.source_ids });
      mergedGroups += 1;
      mergedSources += result.mergedSourceIds.length;
      moved = {
        notes: moved.notes + result.moved.notes,
        statusHistory: moved.statusHistory + result.moved.statusHistory,
        activities: moved.activities + result.moved.activities,
        deals: moved.deals + result.moved.deals,
        creditTransactions: moved.creditTransactions + result.moved.creditTransactions,
        notifications: moved.notifications + result.moved.notifications,
      };
      console.log(`  ✓ ${row.phone_key}: kept ${row.target_id}, merged ${result.mergedSourceIds.length}`);
    }

    const after = await activeDuplicateSummary(prisma, args.minPhoneDigits);
    console.log(`Merged groups: ${mergedGroups}`);
    console.log(`Merged source leads: ${mergedSources}`);
    console.log(`Moved notes: ${moved.notes}`);
    console.log(`Moved status history: ${moved.statusHistory}`);
    console.log(`Moved activities: ${moved.activities}`);
    console.log(`Moved deals: ${moved.deals}`);
    console.log(`Moved credit transactions: ${moved.creditTransactions}`);
    console.log(`Moved notifications: ${moved.notifications}`);
    console.log(`Duplicate phone groups after: ${after.duplicateGroups}`);
    console.log(`Rows in duplicate groups after: ${after.duplicateRows}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
