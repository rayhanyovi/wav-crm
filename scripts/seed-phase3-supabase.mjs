import process from "node:process";
import seedData from "../src/data/seed.json" with { type: "json" };

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF || "auyynqzrhwsxbtukrbri";

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

function normalizeLeadSource(source) {
  if (source === "AP_MARKETING" || source === "LP_MARKETING" || source === "OWN_SOURCE" || source === "OTHERS") {
    return source;
  }
  return "OWN_SOURCE";
}

async function query(sql, parameters = []) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql, parameters }),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!response.ok) {
    console.error(JSON.stringify({ status: response.status, data }, null, 2));
    throw new Error("Supabase query failed");
  }
  return data;
}

async function upsertJsonRows(table, rows) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const assignments = columns
    .filter((column) => column !== "id")
    .map((column) => `${column} = excluded.${column}`)
    .join(",\n          ");

  await query(
    `
      insert into public.${table}
      select *
      from jsonb_populate_recordset(null::public.${table}, $1::jsonb)
      on conflict (id) do update set
          ${assignments};
    `,
    [JSON.stringify(rows)],
  );
}

async function alignPolicies() {
  await query(`
    create or replace function public.fn_audit_log()
    returns trigger
    language plpgsql
    security definer
    as $function$
    declare
      v_user_id text;
      v_action audit_action;
      v_old jsonb;
      v_new jsonb;
    begin
      v_user_id := nullif(current_setting('app.crm_user_id', true), '');
      if v_user_id is null then
        v_user_id := public.get_crm_user_id();
      end if;

      if tg_op = 'INSERT' then
        v_action := 'CREATE';
        v_new := to_jsonb(new);
        v_old := null;
      elsif tg_op = 'UPDATE' then
        v_action := 'UPDATE';
        v_old := to_jsonb(old);
        v_new := to_jsonb(new);
      elsif tg_op = 'DELETE' then
        v_action := 'DELETE';
        v_old := to_jsonb(old);
        v_new := null;
      end if;

      insert into public.audit_logs (user_id, entity_type, entity_id, action, metadata)
      values (
        coalesce(v_user_id, new.created_by, old.created_by, 'system'),
        tg_table_name,
        case when tg_op = 'DELETE' then old.id else new.id end,
        v_action,
        jsonb_build_object('old', v_old, 'new', v_new)
      );

      return null;
    end;
    $function$;

    create or replace function public.fn_notify_appointment_set()
    returns trigger
    language plpgsql
    as $function$
    begin
      if new.status = 'APPOINTMENT'
         and (old.status is distinct from 'APPOINTMENT')
         and new.assigned_to_id is not null then
        insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, is_read, created_at)
        values (
          new.assigned_to_id,
          'APPOINTMENT_SET',
          'Appointment set',
          coalesce(new.first_name || ' ' || new.last_name, 'A lead') ||
            case when new.appointment_date is not null
              then ' - ' || new.appointment_date
              else ''
            end || '.',
          'lead',
          new.id,
          false,
          now()
        );
      end if;
      return null;
    end;
    $function$;

    create or replace function public.fn_notify_deal_stage()
    returns trigger
    language plpgsql
    as $function$
    begin
      if new.stage is distinct from old.stage and new.assigned_to_id is not null then
        insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, is_read, created_at)
        values (
          new.assigned_to_id,
          'DEAL_STAGE_CHANGED',
          'Deal stage updated',
          coalesce(new.title, 'A deal') || ' moved to ' || new.stage || '.',
          'deal',
          new.id,
          false,
          now()
        );
      end if;
      return null;
    end;
    $function$;

    create or replace function public.fn_notify_lead_assigned()
    returns trigger
    language plpgsql
    as $function$
    begin
      if new.assigned_to_id is distinct from old.assigned_to_id
         and new.assigned_to_id is not null then
        insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, is_read, created_at)
        values (
          new.assigned_to_id,
          'LEAD_ASSIGNED',
          'New lead assigned to you',
          coalesce(new.first_name || ' ' || new.last_name, 'A lead') || ' has been assigned to you.',
          'lead',
          new.id,
          false,
          now()
        );
      end if;

      if new.telemarketer_owner_id is distinct from old.telemarketer_owner_id
         and new.telemarketer_owner_id is not null then
        insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, is_read, created_at)
        values (
          new.telemarketer_owner_id,
          'LEAD_ASSIGNED',
          'Lead assigned to your queue',
          coalesce(new.first_name || ' ' || new.last_name, 'A lead') || ' has been added to your calling queue.',
          'lead',
          new.id,
          false,
          now()
        );
      end if;

      return null;
    end;
    $function$;

    drop policy if exists contacts_select_linked_deals on public.contacts;
    create policy contacts_select_linked_deals on public.contacts
      for select to authenticated
      using (
        exists (
          select 1
          from deals d
          where d.contact_id = contacts.id
            and (
              get_crm_role() = 'MASTER'
              or d.assigned_to_id = get_crm_user_id()
              or d.telemarketer_id = get_crm_user_id()
              or d.created_by = get_crm_user_id()
            )
        )
      );

    drop policy if exists contacts_update_linked_deals on public.contacts;
    create policy contacts_update_linked_deals on public.contacts
      for update to authenticated
      using (
        exists (
          select 1
          from deals d
          where d.contact_id = contacts.id
            and (
              get_crm_role() = 'MASTER'
              or d.assigned_to_id = get_crm_user_id()
            )
        )
      )
      with check (
        exists (
          select 1
          from deals d
          where d.contact_id = contacts.id
            and (
              get_crm_role() = 'MASTER'
              or d.assigned_to_id = get_crm_user_id()
            )
        )
      );

    drop policy if exists contact_notes_select_linked_deals on public.contact_notes;
    create policy contact_notes_select_linked_deals on public.contact_notes
      for select to authenticated
      using (
        exists (
          select 1
          from deals d
          join contacts c on c.id = d.contact_id
          where c.id = contact_notes.contact_id
            and (
              get_crm_role() = 'MASTER'
              or d.assigned_to_id = get_crm_user_id()
              or d.telemarketer_id = get_crm_user_id()
              or d.created_by = get_crm_user_id()
            )
        )
      );

    drop policy if exists deals_select_released_for_advisers on public.deals;
    create policy deals_select_released_for_advisers on public.deals
      for select to authenticated
      using (
        get_crm_role() = 'ADVISER'
        and assigned_to_id is null
        and stage <> 'CALLING'
      );

    drop policy if exists deals_claim_released_for_advisers on public.deals;
    create policy deals_claim_released_for_advisers on public.deals
      for update to authenticated
      using (
        get_crm_role() = 'ADVISER'
        and assigned_to_id is null
        and stage <> 'CALLING'
      )
      with check (
        get_crm_role() = 'ADVISER'
        and assigned_to_id = get_crm_user_id()
      );
  `);
}

async function seedPhase3Data() {
  const leads = seedData.leads.map((lead) => ({
    id: lead.id,
    salutation: lead.salutation ?? null,
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    age: lead.age ?? null,
    gender: lead.gender ?? null,
    residential_status: lead.residential_status ?? null,
    income_range: lead.income_range ?? null,
    zipcode: lead.zipcode ?? null,
    source: normalizeLeadSource(lead.source),
    status: lead.status,
    personality: lead.personality ?? null,
    preferred_contact_method: lead.preferred_contact_method ?? null,
    best_time_to_call: lead.best_time_to_call ?? null,
    notes: lead.notes ?? null,
    appointment_date: lead.appointment_date ?? null,
    appointment_time: lead.appointment_time ?? null,
    appointment_result: lead.appointment_result ?? null,
    is_abandoned: lead.is_abandoned ?? false,
    abandoned_at: lead.abandoned_at ?? null,
    other_status_note: lead.other_status_note ?? null,
    products_discussed: lead.products_discussed ?? [],
    assigned_to_id: lead.assigned_to_id ?? null,
    telemarketer_owner_id: lead.telemarketer_owner_id ?? null,
    adviser_owner_id: lead.adviser_owner_id ?? null,
    bounce_count: lead.bounce_count ?? 0,
    last_bounced_at: lead.last_bounced_at ?? null,
    call_attempt_count: lead.call_attempt_count ?? 0,
    no_answer_count: lead.no_answer_count ?? 0,
    last_call_attempt_at: lead.last_call_attempt_at ?? null,
    last_no_answer_at: lead.last_no_answer_at ?? null,
    converted_contact_id: lead.converted_contact_id ?? null,
    converted_at: lead.converted_at ?? null,
    created_by: lead.created_by,
    created_at: lead.created_at,
    updated_at: lead.updated_at,
    deleted_at: lead.deleted_at ?? null,
  }));

  const contacts = seedData.contacts.map((contact) => ({
    id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    title: contact.title ?? null,
    source: normalizeLeadSource(contact.source),
    created_by: contact.created_by,
    created_at: contact.created_at,
    updated_at: contact.updated_at,
    deleted_at: contact.deleted_at ?? null,
  }));

  const deals = seedData.deals.map((deal) => ({
    id: deal.id,
    title: deal.title,
    value: deal.value,
    stage: deal.stage,
    lead_id: deal.lead_id ?? null,
    contact_id: deal.contact_id,
    telemarketer_id: deal.telemarketer_id ?? null,
    assigned_to_id: deal.assigned_to_id ?? null,
    expected_close_date: deal.expected_close_date ?? null,
    lost_reason: deal.lost_reason ?? null,
    closed_at: deal.closed_at ?? null,
    insurer: deal.insurer ?? null,
    insurer_ref: deal.insurer_ref ?? null,
    submitted_at: deal.submitted_at ?? null,
    policy_number: deal.policy_number ?? null,
    financial_goal: deal.financial_goal ?? null,
    risk_tolerance: deal.risk_tolerance ?? null,
    investment_horizon: deal.investment_horizon ?? null,
    monthly_investable: deal.monthly_investable ?? null,
    existing_investments: deal.existing_investments ?? null,
    fact_find_notes: deal.fact_find_notes ?? null,
    fact_find_done: deal.fact_find_done ?? false,
    created_by: deal.created_by,
    created_at: deal.created_at,
    updated_at: deal.updated_at,
    deleted_at: deal.deleted_at ?? null,
  }));

  const stageHistory = seedData.stage_history.map((entry) => ({
    id: entry.id,
    deal_id: entry.deal_id,
    from_stage: entry.from_stage ?? null,
    to_stage: entry.to_stage,
    changed_by: entry.changed_by,
    note: entry.note ?? null,
    created_at: entry.created_at,
  }));

  const contactNotes = (seedData.contact_notes ?? []).map((note) => ({
    id: note.id,
    contact_id: note.contact_id,
    content: note.content,
    created_by: note.created_by,
    created_at: note.created_at,
  }));

  const dealProposals = (seedData.deal_proposals ?? []).map((proposal) => ({
    id: proposal.id,
    deal_id: proposal.deal_id,
    name: proposal.name,
    status: proposal.status,
    total_value: proposal.total_value,
    notes: proposal.notes ?? null,
    created_by: proposal.created_by,
    created_at: proposal.created_at,
    updated_at: proposal.updated_at,
  }));

  const proposalLines = (seedData.deal_proposals ?? []).flatMap((proposal) =>
    proposal.lines.map((line) => ({
      id: line.id,
      proposal_id: proposal.id,
      fund_isin: line.fund_isin,
      fund_name: line.fund_name,
      risk_rating: line.risk_rating,
      allocation_pct: line.allocation_pct,
    })),
  );

  await upsertJsonRows("leads", leads);
  await upsertJsonRows("contacts", contacts);
  await upsertJsonRows("deals", deals);
  await upsertJsonRows("stage_history", stageHistory);
  await upsertJsonRows("contact_notes", contactNotes);
  await upsertJsonRows("deal_proposals", dealProposals);
  await upsertJsonRows("deal_proposal_lines", proposalLines);
}

async function main() {
  await alignPolicies();
  await seedPhase3Data();

  const counts = await query(`
    select 'leads' as table_name, count(*)::int as row_count from public.leads where deleted_at is null
    union all
    select 'contacts' as table_name, count(*)::int as row_count from public.contacts where deleted_at is null
    union all select 'contact_notes', count(*)::int from public.contact_notes
    union all select 'deals', count(*)::int from public.deals where deleted_at is null
    union all select 'deal_proposals', count(*)::int from public.deal_proposals
    union all select 'deal_proposal_lines', count(*)::int from public.deal_proposal_lines
    union all select 'stage_history', count(*)::int from public.stage_history
    order by table_name;
  `);

  console.log(JSON.stringify({ counts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
