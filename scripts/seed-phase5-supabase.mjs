import process from "node:process";
import seedData from "../src/data/seed.json" with { type: "json" };

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF || "auyynqzrhwsxbtukrbri";

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

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

async function upsertBundleProducts(rows) {
  if (rows.length === 0) return;

  await query(
    `
      insert into public.bundle_products (bundle_id, product_id, allocation_pct)
      select bundle_id, product_id, allocation_pct
      from jsonb_to_recordset($1::jsonb) as x(
        bundle_id text,
        product_id text,
        allocation_pct numeric
      )
      on conflict (bundle_id, product_id) do update set
        allocation_pct = excluded.allocation_pct;
    `,
    [JSON.stringify(rows)],
  );
}

async function alignSchema() {
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
      v_entity_id text;
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

      v_entity_id := coalesce(
        case when tg_op = 'DELETE' then v_old->>'id' else v_new->>'id' end,
        case
          when tg_table_name = 'bundle_products' then
            coalesce(case when tg_op = 'DELETE' then v_old->>'bundle_id' else v_new->>'bundle_id' end, 'bundle')
            || ':' ||
            coalesce(case when tg_op = 'DELETE' then v_old->>'product_id' else v_new->>'product_id' end, 'product')
        end,
        'unknown'
      );

      insert into public.audit_logs (user_id, entity_type, entity_id, action, metadata)
      values (
        coalesce(
          v_user_id,
          v_new->>'created_by',
          v_old->>'created_by',
          (select id from public.crm_users order by created_at asc limit 1)
        ),
        tg_table_name,
        v_entity_id,
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
         and old.status is distinct from 'APPOINTMENT'
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
          'Lead assigned to you',
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

    create or replace function public.fn_notify_lead_bounced()
    returns trigger
    language plpgsql
    as $function$
    begin
      if coalesce(new.bounce_count, 0) > coalesce(old.bounce_count, 0)
         and old.telemarketer_owner_id is not null then
        insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, is_read, created_at)
        values (
          old.telemarketer_owner_id,
          'LEAD_BOUNCED',
          'Lead back in your queue',
          coalesce(new.first_name || ' ' || new.last_name, 'A lead') || ' was a no-show and moved back to your queue.',
          'lead',
          new.id,
          false,
          now()
        );
      end if;
      return null;
    end;
    $function$;

    create or replace function public.fn_notify_deal_assigned()
    returns trigger
    language plpgsql
    as $function$
    begin
      if new.assigned_to_id is distinct from old.assigned_to_id
         and new.assigned_to_id is not null then
        insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, is_read, created_at)
        values (
          new.assigned_to_id,
          'DEAL_ASSIGNED',
          'Deal assigned to you',
          coalesce(new.title, 'A deal') || ' has been assigned to you.',
          'deal',
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
          'DEAL_STAGE_CHANGE',
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

    do $$
    begin
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'notifications'
      ) then
        execute 'alter publication supabase_realtime add table public.notifications';
      end if;
    end $$;

    drop trigger if exists notify_lead_bounced on public.leads;
    create trigger notify_lead_bounced
      after update on public.leads
      for each row execute function public.fn_notify_lead_bounced();

    drop trigger if exists notify_deal_assigned on public.deals;
    create trigger notify_deal_assigned
      after update on public.deals
      for each row execute function public.fn_notify_deal_assigned();

    drop trigger if exists audit_products on public.products;
    create trigger audit_products
      after insert or update or delete on public.products
      for each row execute function public.fn_audit_log();

    drop trigger if exists audit_bundles on public.bundles;
    create trigger audit_bundles
      after insert or update or delete on public.bundles
      for each row execute function public.fn_audit_log();

    drop trigger if exists audit_bundle_products on public.bundle_products;
    create trigger audit_bundle_products
      after insert or update or delete on public.bundle_products
      for each row execute function public.fn_audit_log();

    drop trigger if exists audit_call_sessions on public.call_sessions;
    create trigger audit_call_sessions
      after insert or update or delete on public.call_sessions
      for each row execute function public.fn_audit_log();

    drop trigger if exists audit_credit_transactions on public.credit_transactions;
    create trigger audit_credit_transactions
      after insert or update or delete on public.credit_transactions
      for each row execute function public.fn_audit_log();

    drop trigger if exists audit_lead_notes on public.lead_notes;
    create trigger audit_lead_notes
      after insert or update or delete on public.lead_notes
      for each row execute function public.fn_audit_log();

    drop trigger if exists audit_contact_notes on public.contact_notes;
    create trigger audit_contact_notes
      after insert or update or delete on public.contact_notes
      for each row execute function public.fn_audit_log();

    drop trigger if exists audit_deal_proposals on public.deal_proposals;
    create trigger audit_deal_proposals
      after insert or update or delete on public.deal_proposals
      for each row execute function public.fn_audit_log();

    drop trigger if exists audit_deal_proposal_lines on public.deal_proposal_lines;
    create trigger audit_deal_proposal_lines
      after insert or update or delete on public.deal_proposal_lines
      for each row execute function public.fn_audit_log();

    drop trigger if exists audit_comments on public.comments;
    create trigger audit_comments
      after insert or update or delete on public.comments
      for each row execute function public.fn_audit_log();

    drop trigger if exists audit_crm_users on public.crm_users;
    create trigger audit_crm_users
      after insert or update or delete on public.crm_users
      for each row execute function public.fn_audit_log();

    create or replace function public.claim_lead(p_lead_id text, p_user_id text default null)
    returns jsonb
    language plpgsql
    security definer
    as $function$
    declare
      v_user_id text;
      v_balance_before integer;
      v_balance_after integer;
    begin
      v_user_id := coalesce(p_user_id, public.get_crm_user_id());

      select credit_balance
      into v_balance_before
      from public.crm_users
      where id = v_user_id
      for update;

      if v_balance_before is null or v_balance_before < 1 then
        raise exception 'Insufficient credits';
      end if;

      v_balance_after := v_balance_before - 1;

      update public.crm_users
      set credit_balance = v_balance_after
      where id = v_user_id;

      update public.leads
      set assigned_to_id = v_user_id,
          updated_at = now()
      where id = p_lead_id;

      insert into public.credit_transactions (
        id, user_id, lead_id, action, balance_before, balance_after, created_at
      )
      values (
        'ctx-' || left(md5(random()::text || clock_timestamp()::text), 8),
        v_user_id,
        p_lead_id,
        'CLAIM',
        v_balance_before,
        v_balance_after,
        now()
      );

      return jsonb_build_object('success', true, 'new_balance', v_balance_after);
    end;
    $function$;

    create or replace function public.return_lead(p_lead_id text, p_user_id text default null)
    returns jsonb
    language plpgsql
    security definer
    as $function$
    declare
      v_user_id text;
      v_balance_before integer;
      v_balance_after integer;
    begin
      v_user_id := coalesce(p_user_id, public.get_crm_user_id());

      select credit_balance
      into v_balance_before
      from public.crm_users
      where id = v_user_id
      for update;

      v_balance_after := coalesce(v_balance_before, 0) + 1;

      update public.crm_users
      set credit_balance = v_balance_after
      where id = v_user_id;

      update public.leads
      set assigned_to_id = null,
          updated_at = now()
      where id = p_lead_id;

      insert into public.credit_transactions (
        id, user_id, lead_id, action, balance_before, balance_after, created_at
      )
      values (
        'ctx-' || left(md5(random()::text || clock_timestamp()::text), 8),
        v_user_id,
        p_lead_id,
        'RETURN',
        coalesce(v_balance_before, 0),
        v_balance_after,
        now()
      );

      return jsonb_build_object('success', true, 'new_balance', v_balance_after);
    end;
    $function$;

    create or replace function public.release_deal(p_deal_id text, p_releaser_id text default null, p_transfer_to text default null)
    returns jsonb
    language plpgsql
    security definer
    as $function$
    declare
      v_releaser_id text;
      v_balance_before integer;
      v_balance_after integer;
    begin
      v_releaser_id := coalesce(p_releaser_id, public.get_crm_user_id());

      select credit_balance
      into v_balance_before
      from public.crm_users
      where id = v_releaser_id
      for update;

      v_balance_after := coalesce(v_balance_before, 0) + 1;

      update public.crm_users
      set credit_balance = v_balance_after
      where id = v_releaser_id;

      update public.deals
      set assigned_to_id = p_transfer_to,
          updated_at = now()
      where id = p_deal_id;

      insert into public.credit_transactions (
        id, user_id, action, balance_before, balance_after, created_at
      )
      values (
        'ctx-' || left(md5(random()::text || clock_timestamp()::text), 8),
        v_releaser_id,
        'RETURN',
        coalesce(v_balance_before, 0),
        v_balance_after,
        now()
      );

      return jsonb_build_object('success', true, 'new_balance', v_balance_after);
    end;
    $function$;

    create or replace function public.convert_lead(p_lead_id text, p_contact jsonb, p_deal jsonb default null, p_user_id text default null)
    returns jsonb
    language plpgsql
    security definer
    as $function$
    declare
      v_user_id text;
      v_contact_id text;
      v_deal_id text;
      v_stage deal_stage;
    begin
      v_user_id := coalesce(p_user_id, public.get_crm_user_id());

      insert into public.contacts (
        id, first_name, last_name, email, phone, title, source, created_by
      )
      values (
        coalesce(p_contact->>'id', 'cnt-' || left(md5(random()::text || clock_timestamp()::text), 8)),
        p_contact->>'first_name',
        p_contact->>'last_name',
        nullif(p_contact->>'email', ''),
        nullif(p_contact->>'phone', ''),
        nullif(p_contact->>'title', ''),
        coalesce(nullif(p_contact->>'source', ''), 'AP_MARKETING')::lead_source,
        v_user_id
      )
      returning id into v_contact_id;

      update public.leads
      set converted_contact_id = v_contact_id,
          converted_at = now(),
          updated_at = now()
      where id = p_lead_id;

      if p_deal is not null then
        v_stage := coalesce(nullif(p_deal->>'stage', ''), 'APPOINTMENT')::deal_stage;

        insert into public.deals (
          id, title, value, stage, lead_id, contact_id,
          assigned_to_id, telemarketer_id, expected_close_date, created_by
        )
        values (
          coalesce(p_deal->>'id', 'deal-' || left(md5(random()::text || clock_timestamp()::text), 8)),
          p_deal->>'title',
          coalesce((p_deal->>'value')::numeric, 0),
          v_stage,
          p_lead_id,
          v_contact_id,
          nullif(p_deal->>'assigned_to_id', ''),
          nullif(p_deal->>'telemarketer_id', ''),
          nullif(p_deal->>'expected_close_date', '')::date,
          v_user_id
        )
        returning id into v_deal_id;

        insert into public.stage_history (
          id, deal_id, from_stage, to_stage, changed_by, note, created_at
        )
        values (
          'sh-' || left(md5(random()::text || clock_timestamp()::text), 8),
          v_deal_id,
          null,
          v_stage,
          v_user_id,
          'Lead converted to deal',
          now()
        );
      end if;

      return jsonb_build_object('contact_id', v_contact_id, 'deal_id', v_deal_id);
    end;
    $function$;
  `);
}

async function seedSupportingEntities() {
  const products = (seedData.products ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    ticker: product.ticker,
    description: product.description ?? null,
    category: product.category,
    risk_score: product.risk_score,
    annual_return: product.annual_return ?? null,
    market_cap: product.market_cap ?? null,
    is_active: product.is_active,
    created_at: product.created_at,
  }));

  const bundles = (seedData.bundles ?? []).map((bundle) => ({
    id: bundle.id,
    name: bundle.name,
    description: bundle.description ?? null,
    risk_score: bundle.risk_score,
    is_active: bundle.is_active,
    created_at: bundle.created_at,
  }));

  const bundleProducts = (seedData.bundles ?? []).flatMap((bundle) =>
    (bundle.product_ids ?? []).map((productId) => ({
      bundle_id: bundle.id,
      product_id: productId,
      allocation_pct: bundle.allocations?.[productId] ?? 0,
    })),
  );

  await upsertJsonRows("products", products);
  await upsertJsonRows("bundles", bundles);
  await upsertBundleProducts(bundleProducts);
}

async function reportCounts() {
  const rows = await query(`
    select 'products' as table_name, count(*)::int as count from public.products
    union all select 'bundles', count(*)::int from public.bundles
    union all select 'bundle_products', count(*)::int from public.bundle_products
    union all select 'notifications', count(*)::int from public.notifications
    union all select 'audit_logs', count(*)::int from public.audit_logs
    union all select 'call_sessions', count(*)::int from public.call_sessions
    union all select 'credit_transactions', count(*)::int from public.credit_transactions
    order by table_name;
  `);

  console.log(JSON.stringify(rows, null, 2));
}

await alignSchema();
await seedSupportingEntities();
await reportCounts();
