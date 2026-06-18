import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { PrismaClient } from "../prisma/generated/client/index.js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.server" });
dotenv.config({ path: ".env" });

const DEFAULT_MIN_PHONE_DIGITS = 6;

function parseArgs(argv) {
  const out = {
    apply: false,
    confirmSoftDelete: false,
    actorId: process.env.DEDUPE_ACTOR_ID ?? "",
    minPhoneDigits: DEFAULT_MIN_PHONE_DIGITS,
    report: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") out.apply = true;
    else if (arg === "--confirm-soft-delete") out.confirmSoftDelete = true;
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
  if (out.apply && !out.confirmSoftDelete) {
    throw new Error("Refusing to apply without --confirm-soft-delete");
  }
  return out;
}

function printHelp() {
  console.log(`Usage:
  npm run leads:dedupe:dry
  npm run leads:dedupe:apply -- --actor-id <crm_user_id>

Options:
  --apply                 Soft-delete candidate duplicate leads. Default is dry-run.
  --confirm-soft-delete   Required together with --apply.
  --actor-id <id>         Audit-log user id. Defaults to DEDUPE_ACTOR_ID or first active MASTER.
  --min-phone-digits <n>  Ignore phone keys shorter than n digits. Default: ${DEFAULT_MIN_PHONE_DIGITS}.
  --report <path>         CSV output path. Default: tmp/lead-dedupe-report-<timestamp>.csv.
`);
}

function prismaUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543") {
      url.searchParams.set("pgbouncer", "true");
      url.searchParams.set("connection_limit", "1");
    }
    return url.toString();
  } catch {
    return raw;
  }
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
    "action",
    "reason",
    "phone_key",
    "group_size",
    "touched_in_group",
    "touch_score",
    "touch_reasons",
    "lead_id",
    "name",
    "phone",
    "status",
    "source",
    "created_at",
    "updated_at",
    "created_by",
    "assigned_to_id",
    "telemarketer_owner_id",
    "adviser_owner_id",
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

function stringifyJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function firstMasterId(prisma) {
  const master = await prisma.crmUser.findFirst({
    where: { role: "MASTER", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return master?.id ?? "";
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
    end as delete_candidate,
    case
      when touched_in_group > 0 and touch_score = 0 then 'untouched_duplicate_kept_worked_row'
      when touched_in_group = 0 and oldest_rank > 1 then 'all_untouched_keep_oldest'
      when touched_in_group = 0 and oldest_rank = 1 then 'oldest_untouched_kept'
      when touched_in_group > 1 then 'worked_duplicate_manual_review'
      else 'worked_row_kept'
    end as reason
  from ranked
)
select
  case
    when delete_candidate then 'soft_delete_candidate'
    when reason = 'worked_duplicate_manual_review' then 'manual_review_keep'
    else 'keep'
  end as action,
  reason,
  phone_key,
  group_size,
  touched_in_group,
  touch_score,
  touch_reasons,
  lead_id,
  trim(first_name || ' ' || last_name) as name,
  phone,
  status,
  source,
  created_at,
  updated_at,
  created_by,
  assigned_to_id,
  telemarketer_owner_id,
  adviser_owner_id
from classified
order by phone_key, delete_candidate asc, touch_score desc, created_at asc, lead_id asc;
`;
}

async function loadDuplicateRows(prisma, minPhoneDigits) {
  return prisma.$queryRawUnsafe(duplicateRowsSql(minPhoneDigits));
}

async function loadActiveLeadCount(prisma) {
  const rows = await prisma.$queryRaw`select count(*)::int as count from public.leads where deleted_at is null`;
  return toInt(rows[0]?.count);
}

function summarize(rows, activeLeadCount) {
  const phoneKeys = new Set(rows.map((row) => row.phone_key));
  const candidateRows = rows.filter((row) => row.action === "soft_delete_candidate");
  const manualReviewKeys = new Set(
    rows
      .filter((row) => row.reason === "worked_duplicate_manual_review")
      .map((row) => row.phone_key),
  );
  const touchedRows = rows.filter((row) => toInt(row.touch_score) > 0);
  const untouchedRows = rows.filter((row) => toInt(row.touch_score) === 0);

  return {
    activeLeadCount,
    duplicatePhoneGroups: phoneKeys.size,
    duplicateRows: rows.length,
    deleteCandidates: candidateRows.length,
    groupsWithCandidates: new Set(candidateRows.map((row) => row.phone_key)).size,
    groupsWithMultipleTouched: manualReviewKeys.size,
    touchedDuplicateRows: touchedRows.length,
    untouchedDuplicateRows: untouchedRows.length,
  };
}

function printSummary(summary, mode, reportPath) {
  console.log(`Mode: ${mode}`);
  console.log(`Active leads: ${summary.activeLeadCount}`);
  console.log(`Duplicate phone groups: ${summary.duplicatePhoneGroups}`);
  console.log(`Rows in duplicate groups: ${summary.duplicateRows}`);
  console.log(`Soft-delete candidates: ${summary.deleteCandidates}`);
  console.log(`Groups with candidates: ${summary.groupsWithCandidates}`);
  console.log(`Groups needing manual review (multiple worked rows): ${summary.groupsWithMultipleTouched}`);
  console.log(`Touched duplicate rows: ${summary.touchedDuplicateRows}`);
  console.log(`Untouched duplicate rows: ${summary.untouchedDuplicateRows}`);
  console.log(`Report: ${reportPath}`);
}

async function applySoftDeletes(prisma, candidateRows, actorId) {
  if (candidateRows.length === 0) return { softDeleted: 0, skippedChanged: 0 };

  const ids = candidateRows.map((row) => row.lead_id);
  const rowsById = new Map(candidateRows.map((row) => [row.lead_id, row]));
  const oldRows = await prisma.lead.findMany({
    where: { id: { in: ids }, deletedAt: null },
  });
  const oldRowsById = new Map(oldRows.map((row) => [row.id, row]));
  const deletedAt = new Date();
  let softDeleted = 0;
  let skippedChanged = 0;

  await prisma.$transaction(async (tx) => {
    for (const candidate of candidateRows) {
      const update = await tx.lead.updateMany({
        where: {
          id: candidate.lead_id,
          deletedAt: null,
          updatedAt: candidate.updated_at,
        },
        data: { deletedAt },
      });

      if (update.count !== 1) {
        skippedChanged += 1;
        continue;
      }

      const old = oldRowsById.get(candidate.lead_id);
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entityType: "leads",
          entityId: candidate.lead_id,
          metadata: stringifyJson({
            old: old ?? null,
            new: null,
            cleanup: {
              reason: rowsById.get(candidate.lead_id)?.reason,
              phoneKey: candidate.phone_key,
              script: "scripts/dedupe-leads-by-phone.mjs",
            },
          }),
        },
      });
      softDeleted += 1;
    }
  });

  return { softDeleted, skippedChanged };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = prismaUrl();
  if (!url) throw new Error("Missing DATABASE_URL");

  const prisma = new PrismaClient({
    datasources: { db: { url } },
    log: ["warn", "error"],
  });

  try {
    const rows = await loadDuplicateRows(prisma, args.minPhoneDigits);
    const activeLeadCount = await loadActiveLeadCount(prisma);
    const summary = summarize(rows, activeLeadCount);
    const reportPath = path.resolve(args.report || `tmp/lead-dedupe-report-${nowStamp()}.csv`);

    writeCsv(reportPath, rows);
    printSummary(summary, args.apply ? "apply" : "dry-run", reportPath);

    if (!args.apply) {
      console.log("No data changed.");
      return;
    }

    const actorId = args.actorId || await firstMasterId(prisma);
    if (!actorId) {
      throw new Error("No --actor-id supplied and no active MASTER user found for audit logs");
    }

    const candidateRows = rows.filter((row) => row.action === "soft_delete_candidate");
    const result = await applySoftDeletes(prisma, candidateRows, actorId);
    console.log(`Soft-deleted: ${result.softDeleted}`);
    console.log(`Skipped because row changed before update: ${result.skippedChanged}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
