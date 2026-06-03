import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "auyynqzrhwsxbtukrbri";
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

const ROOT = process.cwd();
const DEFAULT_PASSWORD = process.env.WAV_SEED_PASSWORD || "WavCRM@2026!";

const AUTH_USERS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    appId: "user-1",
    name: "WAV Master",
    email: "master@wav.sg",
    role: "MASTER",
    creditBalance: 0,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    appId: "user-2",
    name: "Junhao",
    email: "junhao@wav.sg",
    role: "ADVISER",
    creditBalance: 3,
    telemarketerAccess: true,
    telemarketerId: "user-4",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    appId: "user-3",
    name: "Javier",
    email: "javier@wav.sg",
    role: "ADVISER",
    creditBalance: 5,
    telemarketerAccess: true,
    telemarketerId: "user-4",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    appId: "user-4",
    name: "Yinesa",
    email: "yinesa@wav.sg",
    role: "TELEMARKETER",
    creditBalance: 0,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    appId: "user-5",
    name: "Zee",
    email: "zee@wav.sg",
    role: "TELEMARKETER",
    creditBalance: 0,
  },
];

function workbook(fileName) {
  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing workbook: ${fileName}`);
  }
  return XLSX.readFile(filePath, { cellDates: true });
}

function rowsFromSheet(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
}

function clean(value) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function nullable(value) {
  const text = clean(value);
  if (!text || text === "-" || /^null$/i.test(text)) return null;
  return text;
}

function numberOrNull(value) {
  const text = clean(value).replace(/[%,$]/g, "");
  if (!text || text === "-") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerOrNull(value) {
  const parsed = numberOrNull(value);
  return parsed == null ? null : Math.trunc(parsed);
}

function phoneOrNull(value) {
  const text = clean(value);
  if (!text) return null;
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) return String(Math.trunc(numeric));
  return text.replace(/[^\d+]/g, "") || null;
}

function isoDateOrNull(value) {
  const text = clean(value);
  if (!text || text === "-") return null;

  const asDate = new Date(text);
  if (!Number.isNaN(asDate.getTime())) return asDate.toISOString().slice(0, 10);

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

function headerMap(row) {
  const map = new Map();
  row.forEach((value, index) => {
    const key = clean(value).toLowerCase();
    if (key) map.set(key, index);
  });
  return map;
}

function cell(row, map, ...names) {
  for (const name of names) {
    const index = map.get(name.toLowerCase());
    if (index != null) return row[index] ?? "";
  }
  return "";
}

function rowObject(row, headers) {
  const raw = {};
  headers.forEach((header, index) => {
    const key = clean(header) || `column_${index + 1}`;
    raw[key] = row[index] ?? "";
  });
  return raw;
}

function stableId(prefix, parts) {
  return `${prefix}-${parts.map((part) => clean(part).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x").join("-")}`;
}

function parseFunds() {
  const wb = workbook("SGA Master Fund List.xlsx");
  const funds = [];

  for (const sheetName of wb.SheetNames) {
    const rows = rowsFromSheet(wb.Sheets[sheetName]);
    const headerIndex = rows.findIndex((row) => row.some((value) => clean(value).toLowerCase() === "isin"));
    if (headerIndex < 0) continue;

    const headers = rows[headerIndex].map(clean);
    const map = headerMap(headers);

    rows.slice(headerIndex + 1).forEach((row, offset) => {
      const isin = nullable(cell(row, map, "isin"));
      const fundName = nullable(cell(row, map, "fund name"));
      if (!isin || !fundName) return;

      const platforms = {};
      [
        "CPF-OA", "CPF-SA", "Navi", "iFAST", "PSPL (FAME)", "Singlife", "FWD",
        "Manulife", "Tokio Marine", "Income", "HSBC Life", "Etiqa",
      ].forEach((name) => {
        const value = nullable(cell(row, map, name));
        if (value) platforms[name] = value;
      });

      funds.push({
        id: stableId("fund", [sheetName, headerIndex + offset + 2, isin]),
        source_sheet: sheetName,
        source_row_number: headerIndex + offset + 2,
        isin,
        fund_management_company: nullable(cell(row, map, "fund management company", "insurer")),
        fund_name: fundName,
        currency: nullable(cell(row, map, "currency")),
        asset_class: nullable(cell(row, map, "asset class")),
        geographic_focus: nullable(cell(row, map, "geographic focus")),
        sga_classification: nullable(cell(row, map, "sga classification")),
        risk_classification: nullable(cell(row, map, "fund risk classification", "risk")),
        risk_rating: numberOrNull(cell(row, map, "fund risk rating")),
        management_fee: numberOrNull(cell(row, map, "management fee")),
        total_expense_ratio: numberOrNull(cell(row, map, "total expense ratio")),
        inception_date: isoDateOrNull(cell(row, map, "inception date")),
        dividend_yield: numberOrNull(cell(row, map, "est. dividend yield (%)", "dividend yield")),
        last_dividend_ex_date: isoDateOrNull(cell(row, map, "last dividend ex-date", "dividend date")),
        dividend_frequency: nullable(cell(row, map, "dividend frequency")),
        platform_availability: platforms,
        raw_data: rowObject(row, headers),
      });
    });
  }

  return funds;
}

function parseLeadReference() {
  const wb = workbook("LEADS.xlsx");
  const rows = rowsFromSheet(wb.Sheets[wb.SheetNames[0]]);
  const headers = rows[0].map(clean);
  const map = headerMap(headers);

  return rows.slice(1).map((row, index) => ({
    id: `lead-ref-${String(index + 2).padStart(5, "0")}`,
    source_file: "LEADS.xlsx",
    source_sheet: wb.SheetNames[0],
    source_row_number: index + 2,
    salutation: nullable(cell(row, map, "salutation")),
    first_name: nullable(cell(row, map, "firstname", "first name")),
    last_name: nullable(cell(row, map, "lastname", "last name")),
    gender: nullable(cell(row, map, "gender")),
    age: integerOrNull(cell(row, map, "age")),
    phone: phoneOrNull(cell(row, map, "phone")),
    residential_status: nullable(cell(row, map, "residential", "residential status")),
    income_range: nullable(cell(row, map, "income")),
    race: nullable(cell(row, map, "race")),
    site: nullable(cell(row, map, "site")),
    zipcode: nullable(cell(row, map, "zipcode", "postcode")),
    raw_data: rowObject(row, headers),
  })).filter((row) => row.first_name || row.last_name || row.phone);
}

function detectCallingHeader(rows) {
  return rows.findIndex((row) => row.some((value) => /first\s*name|firstname/i.test(clean(value))));
}

function parseScripts(wb) {
  const scripts = [];
  for (const sheetName of ["Script 1", "Script 2"]) {
    const rows = rowsFromSheet(wb.Sheets[sheetName]);
    rows.forEach((row, index) => {
      const lineText = nullable(row.find((value, cellIndex) => cellIndex < 2 && nullable(value)));
      const payoutText = nullable(row[2]);
      if (!lineText && !payoutText) return;
      scripts.push({
        id: stableId("script", [sheetName, index + 1]),
        script_name: sheetName,
        source_sheet: sheetName,
        source_row_number: index + 1,
        line_order: index + 1,
        line_text: lineText,
        payout_text: payoutText,
        raw_data: rowObject(row, ["script_text", "extra_text", "payout"]),
      });
    });
  }
  return scripts;
}

function parseCallingLeads() {
  const wb = workbook("Calling.xlsx");
  const leads = [];

  for (const sheetName of wb.SheetNames) {
    if (/^script/i.test(sheetName)) continue;
    const rows = rowsFromSheet(wb.Sheets[sheetName]);
    const headerIndex = detectCallingHeader(rows);
    if (headerIndex < 0) continue;

    const headers = rows[headerIndex].map(clean);
    const map = headerMap(headers);
    const listType = /^follow/i.test(sheetName) ? "FOLLOW_UP" : /^main/i.test(sheetName) ? "MAIN" : "BATCH";
    const adviserName = (sheetName.match(/\(([^)]+)\)/)?.[1] ?? "").trim() || null;

    rows.slice(headerIndex + 1).forEach((row, offset) => {
      const firstName = nullable(cell(row, map, "firstname", "first name"));
      const lastName = nullable(cell(row, map, "lastname", "last name"));
      const phone = phoneOrNull(cell(row, map, "phone"));
      if (!firstName && !lastName && !phone) return;

      const attempts = [
        { attempt: 1, date: isoDateOrNull(cell(row, map, "1st attempt", "1st follow-up attempt (tele)")), remarks: nullable(cell(row, map, "remarks", "1st follow-up attempt (tele)")) },
        { attempt: 2, date: isoDateOrNull(cell(row, map, "2nd attempt", "2nd follow-up attempt (tele)")), remarks: nullable(cell(row, map, "remarks_1", "2nd follow-up attempt (tele)")) },
        { attempt: 3, date: isoDateOrNull(cell(row, map, "3rd attempt")), remarks: nullable(cell(row, map, "remarks_2")) },
      ].filter((attempt) => attempt.date || attempt.remarks);

      const adviserRemarks = {};
      headers.forEach((header, idx) => {
        if (/remarks\s*\((junhao|javier)/i.test(header) || /^status\s*\((junhao|javier)/i.test(header) || /agent remarks/i.test(header)) {
          const value = nullable(row[idx]);
          if (value) adviserRemarks[header] = value;
        }
      });

      leads.push({
        id: stableId("calling", [sheetName, headerIndex + offset + 2, firstName || "", lastName || "", phone || ""]),
        source_file: "Calling.xlsx",
        source_sheet: sheetName,
        source_row_number: headerIndex + offset + 2,
        batch_name: sheetName,
        list_type: listType,
        adviser_name: adviserName,
        salutation: nullable(cell(row, map, "salutation")),
        first_name: firstName,
        last_name: lastName,
        gender: nullable(cell(row, map, "gender")),
        age: integerOrNull(cell(row, map, "age")),
        phone,
        residential_status: nullable(cell(row, map, "residential", "residential status")),
        income_range: nullable(cell(row, map, "income")),
        race: nullable(cell(row, map, "race")),
        site: nullable(cell(row, map, "site")),
        zipcode: nullable(cell(row, map, "zipcode", "postcode")),
        appointment_date: isoDateOrNull(cell(row, map, "appointment date")),
        appointment_time: nullable(cell(row, map, "appointment time")),
        attempts,
        telemarketer_remarks: nullable(cell(row, map, "remarks", "remarks (tele)")),
        adviser_remarks: adviserRemarks,
        raw_data: rowObject(row, headers),
      });
    });
  }

  return { scripts: parseScripts(wb), leads };
}

async function query(sql, parameters = []) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
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

async function setupSchema() {
  await query(`
    create extension if not exists pgcrypto with schema extensions;

    create table if not exists public.crm_users (
      id text primary key,
      auth_user_id uuid unique references auth.users(id) on delete set null,
      name text not null,
      email text not null unique,
      role text not null check (role in ('MASTER', 'ADVISER', 'TELEMARKETER')),
      avatar text,
      is_active boolean not null default true,
      credit_balance integer not null default 0,
      telemarketer_access boolean not null default false,
      telemarketer_id text references public.crm_users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists public.sga_funds (
      id text primary key,
      source_sheet text not null,
      source_row_number integer not null,
      isin text not null,
      fund_management_company text,
      fund_name text not null,
      currency text,
      asset_class text,
      geographic_focus text,
      sga_classification text,
      risk_classification text,
      risk_rating numeric,
      management_fee numeric,
      total_expense_ratio numeric,
      inception_date date,
      dividend_yield numeric,
      last_dividend_ex_date date,
      dividend_frequency text,
      platform_availability jsonb not null default '{}'::jsonb,
      raw_data jsonb not null default '{}'::jsonb,
      seeded_at timestamptz not null default now(),
      unique (source_sheet, source_row_number)
    );

    create table if not exists public.lead_import_reference (
      id text primary key,
      source_file text not null,
      source_sheet text not null,
      source_row_number integer not null,
      salutation text,
      first_name text,
      last_name text,
      gender text,
      age integer,
      phone text,
      residential_status text,
      income_range text,
      race text,
      site text,
      zipcode text,
      raw_data jsonb not null default '{}'::jsonb,
      seeded_at timestamptz not null default now(),
      unique (source_file, source_sheet, source_row_number)
    );

    create table if not exists public.calling_scripts (
      id text primary key,
      script_name text not null,
      source_sheet text not null,
      source_row_number integer not null,
      line_order integer not null,
      line_text text,
      payout_text text,
      raw_data jsonb not null default '{}'::jsonb,
      seeded_at timestamptz not null default now(),
      unique (source_sheet, source_row_number)
    );

    create table if not exists public.calling_leads (
      id text primary key,
      source_file text not null,
      source_sheet text not null,
      source_row_number integer not null,
      batch_name text not null,
      list_type text not null,
      adviser_name text,
      salutation text,
      first_name text,
      last_name text,
      gender text,
      age integer,
      phone text,
      residential_status text,
      income_range text,
      race text,
      site text,
      zipcode text,
      appointment_date date,
      appointment_time text,
      attempts jsonb not null default '[]'::jsonb,
      telemarketer_remarks text,
      adviser_remarks jsonb not null default '{}'::jsonb,
      raw_data jsonb not null default '{}'::jsonb,
      seeded_at timestamptz not null default now(),
      unique (source_file, source_sheet, source_row_number)
    );

    create index if not exists sga_funds_isin_idx on public.sga_funds (isin);
    create index if not exists lead_import_reference_phone_idx on public.lead_import_reference (phone);
    create index if not exists calling_leads_phone_idx on public.calling_leads (phone);
    create index if not exists calling_leads_sheet_idx on public.calling_leads (source_sheet);

    alter table public.crm_users enable row level security;
    alter table public.sga_funds enable row level security;
    alter table public.lead_import_reference enable row level security;
    alter table public.calling_scripts enable row level security;
    alter table public.calling_leads enable row level security;

    drop policy if exists crm_users_authenticated_select on public.crm_users;
    create policy crm_users_authenticated_select on public.crm_users
      for select to authenticated
      using (true);

    drop policy if exists crm_users_self_update on public.crm_users;
    create policy crm_users_self_update on public.crm_users
      for update to authenticated
      using (auth_user_id = auth.uid())
      with check (auth_user_id = auth.uid());

    drop policy if exists sga_funds_authenticated_select on public.sga_funds;
    create policy sga_funds_authenticated_select on public.sga_funds
      for select to authenticated
      using (true);

    drop policy if exists lead_import_reference_authenticated_select on public.lead_import_reference;
    create policy lead_import_reference_authenticated_select on public.lead_import_reference
      for select to authenticated
      using (true);

    drop policy if exists calling_scripts_authenticated_select on public.calling_scripts;
    create policy calling_scripts_authenticated_select on public.calling_scripts
      for select to authenticated
      using (true);

    drop policy if exists calling_leads_authenticated_select on public.calling_leads;
    create policy calling_leads_authenticated_select on public.calling_leads
      for select to authenticated
      using (true);

    grant usage on schema public to anon, authenticated;
    grant select on public.crm_users, public.sga_funds, public.lead_import_reference, public.calling_scripts, public.calling_leads to authenticated;
    grant update (name, avatar, updated_at) on public.crm_users to authenticated;
  `);
}

async function seedUsers() {
  await query(
    `
      with seed_users as (
        select *
        from jsonb_to_recordset($1::jsonb) as x(
          id uuid,
          app_id text,
          name text,
          email text,
          role text,
          credit_balance integer,
          telemarketer_access boolean,
          telemarketer_id text
        )
      ),
      auth_upsert as (
        insert into auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, confirmation_token, recovery_token,
          email_change_token_new, email_change, email_change_token_current,
          phone_change, phone_change_token, reauthentication_token,
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        )
        select
          '00000000-0000-0000-0000-000000000000'::uuid,
          id,
          'authenticated',
          'authenticated',
          email,
          crypt($2, gen_salt('bf')),
          now(),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', role),
          jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false, 'name', name),
          now(),
          now()
        from seed_users
        on conflict (id) do update set
          email = excluded.email,
          encrypted_password = excluded.encrypted_password,
          email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
          confirmation_token = excluded.confirmation_token,
          recovery_token = excluded.recovery_token,
          email_change_token_new = excluded.email_change_token_new,
          email_change = excluded.email_change,
          email_change_token_current = excluded.email_change_token_current,
          phone_change = excluded.phone_change,
          phone_change_token = excluded.phone_change_token,
          reauthentication_token = excluded.reauthentication_token,
          raw_app_meta_data = excluded.raw_app_meta_data,
          raw_user_meta_data = excluded.raw_user_meta_data,
          updated_at = now()
        returning id, email
      ),
      identities_upsert as (
        insert into auth.identities (
          provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        )
        select
          id::text,
          id,
          jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
          'email',
          now(),
          now(),
          now()
        from seed_users
        on conflict (provider, provider_id) do update set
          identity_data = excluded.identity_data,
          updated_at = now()
        returning user_id
      )
      insert into public.crm_users (
        id, auth_user_id, name, email, role, is_active, credit_balance,
        telemarketer_access, telemarketer_id, created_at, updated_at
      )
      select
        app_id, id, name, email, role, true, coalesce(credit_balance, 0),
        coalesce(telemarketer_access, false), telemarketer_id, now(), now()
      from seed_users
      on conflict (id) do update set
        auth_user_id = excluded.auth_user_id,
        name = excluded.name,
        email = excluded.email,
        role = excluded.role,
        is_active = excluded.is_active,
        credit_balance = excluded.credit_balance,
        telemarketer_access = excluded.telemarketer_access,
        telemarketer_id = excluded.telemarketer_id,
        updated_at = now();
    `,
    [
      JSON.stringify(
        AUTH_USERS.map((user) => ({
          id: user.id,
          app_id: user.appId,
          name: user.name,
          email: user.email,
          role: user.role,
          credit_balance: user.creditBalance,
          telemarketer_access: user.telemarketerAccess ?? false,
          telemarketer_id: user.telemarketerId ?? null,
        })),
      ),
      DEFAULT_PASSWORD,
    ],
  );
}

async function replaceTable(table, rows) {
  await query(`truncate table public.${table};`);
  const chunkSize = 300;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((row) => ({
      seeded_at: new Date().toISOString(),
      ...row,
    }));
    await query(
      `
        insert into public.${table}
        select *
        from jsonb_populate_recordset(null::public.${table}, $1::jsonb)
        on conflict (id) do update set
          ${Object.keys(chunk[0])
            .filter((key) => key !== "id")
            .map((key) => `${key} = excluded.${key}`)
            .join(",\n          ")};
      `,
      [JSON.stringify(chunk)],
    );
  }
}

async function main() {
  const funds = parseFunds();
  const leadReferences = parseLeadReference();
  const { scripts, leads } = parseCallingLeads();

  console.log(`Parsed ${funds.length} SGA fund rows.`);
  console.log(`Parsed ${leadReferences.length} lead reference rows.`);
  console.log(`Parsed ${scripts.length} calling script rows.`);
  console.log(`Parsed ${leads.length} calling lead rows.`);

  await setupSchema();
  await seedUsers();
  await replaceTable("sga_funds", funds);
  await replaceTable("lead_import_reference", leadReferences);
  await replaceTable("calling_scripts", scripts);
  await replaceTable("calling_leads", leads);

  const counts = await query(`
    select 'crm_users' as table_name, count(*)::int as row_count from public.crm_users
    union all select 'sga_funds', count(*)::int from public.sga_funds
    union all select 'lead_import_reference', count(*)::int from public.lead_import_reference
    union all select 'calling_scripts', count(*)::int from public.calling_scripts
    union all select 'calling_leads', count(*)::int from public.calling_leads
    order by table_name;
  `);

  console.log(JSON.stringify({ counts, loginPassword: DEFAULT_PASSWORD }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
