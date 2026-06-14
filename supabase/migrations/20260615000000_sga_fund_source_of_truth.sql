-- WAV CRM — SGA fund workbook source-of-truth schema.
-- Canonical funds remain in public.sga_funds, with provenance rows and
-- normalized platform availability stored separately.

alter table public.sga_funds
  add column if not exists source_sheets text[] not null default '{}',
  add column if not exists dividend_date date,
  add column if not exists insurers text[] not null default '{}';

create table if not exists public.sga_fund_source_rows (
  id text primary key,
  fund_id text not null references public.sga_funds(id) on delete cascade,
  sheet_name text not null,
  source_row_number integer not null,
  isin text,
  fund_management_company text,
  insurer text,
  fund_name text,
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
  dividend_date date,
  dividend_frequency text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (sheet_name, source_row_number)
);

create table if not exists public.sga_fund_platform_availability (
  id text primary key,
  fund_id text not null references public.sga_funds(id) on delete cascade,
  source_row_id text references public.sga_fund_source_rows(id) on delete cascade,
  platform_name text not null,
  availability_value text not null,
  source_sheet text not null,
  source_row_number integer not null,
  created_at timestamptz not null default now(),
  unique (fund_id, platform_name, source_sheet, source_row_number)
);

create index if not exists sga_funds_source_sheets_idx on public.sga_funds using gin (source_sheets);
create index if not exists sga_funds_insurers_idx on public.sga_funds using gin (insurers);
create index if not exists sga_funds_isin_fund_currency_idx on public.sga_funds (isin, fund_name, currency);
create index if not exists sga_fund_source_rows_fund_id_idx on public.sga_fund_source_rows (fund_id);
create index if not exists sga_fund_source_rows_sheet_idx on public.sga_fund_source_rows (sheet_name);
create index if not exists sga_fund_platform_availability_fund_id_idx on public.sga_fund_platform_availability (fund_id);
create index if not exists sga_fund_platform_availability_platform_idx on public.sga_fund_platform_availability (platform_name);

alter table public.sga_fund_source_rows enable row level security;
alter table public.sga_fund_platform_availability enable row level security;

drop policy if exists sga_fund_source_rows_authenticated_select on public.sga_fund_source_rows;
create policy sga_fund_source_rows_authenticated_select on public.sga_fund_source_rows
  for select
  to authenticated
  using (true);

drop policy if exists sga_fund_platform_availability_authenticated_select on public.sga_fund_platform_availability;
create policy sga_fund_platform_availability_authenticated_select on public.sga_fund_platform_availability
  for select
  to authenticated
  using (true);

grant select on public.sga_fund_source_rows, public.sga_fund_platform_availability to authenticated;
