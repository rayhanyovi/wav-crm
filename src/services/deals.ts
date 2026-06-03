import { nanoid } from "nanoid";
import { supabase } from "@/lib/supabase";
import type {
  Deal,
  DealProposal,
  DealProposalLine,
  DealProposalStatus,
  DealStage,
  FinancialGoal,
  InvestmentHorizon,
  RiskTolerance,
  StageHistoryEntry,
} from "@/data/types";

const DEAL_SELECT = [
  "id",
  "title",
  "value",
  "stage",
  "lead_id",
  "contact_id",
  "telemarketer_id",
  "assigned_to_id",
  "expected_close_date",
  "lost_reason",
  "closed_at",
  "insurer",
  "insurer_ref",
  "submitted_at",
  "policy_number",
  "financial_goal",
  "risk_tolerance",
  "investment_horizon",
  "monthly_investable",
  "existing_investments",
  "fact_find_notes",
  "fact_find_done",
  "created_by",
  "created_at",
  "updated_at",
  "deleted_at",
].join(",");

const DEAL_PROPOSAL_SELECT =
  "id,deal_id,name,status,total_value,notes,created_by,created_at,updated_at";
const DEAL_PROPOSAL_LINE_SELECT =
  "id,proposal_id,fund_isin,fund_name,risk_rating,allocation_pct";
const STAGE_HISTORY_SELECT =
  "id,deal_id,from_stage,to_stage,changed_by,note,created_at";

interface DealRow {
  id: string;
  title: string;
  value: number | string;
  stage: DealStage;
  lead_id: string | null;
  contact_id: string;
  telemarketer_id: string | null;
  assigned_to_id: string | null;
  expected_close_date: string | null;
  lost_reason: string | null;
  closed_at: string | null;
  insurer: string | null;
  insurer_ref: string | null;
  submitted_at: string | null;
  policy_number: string | null;
  financial_goal: FinancialGoal | null;
  risk_tolerance: RiskTolerance | null;
  investment_horizon: InvestmentHorizon | null;
  monthly_investable: number | string | null;
  existing_investments: string | null;
  fact_find_notes: string | null;
  fact_find_done: boolean | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface DealProposalRow {
  id: string;
  deal_id: string;
  name: string;
  status: DealProposalStatus;
  total_value: number | string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface DealProposalLineRow {
  id: string;
  proposal_id: string;
  fund_isin: string;
  fund_name: string;
  risk_rating: number;
  allocation_pct: number | string;
}

interface StageHistoryRow {
  id: string;
  deal_id: string;
  from_stage: DealStage | null;
  to_stage: DealStage;
  changed_by: string;
  note: string | null;
  created_at: string;
}

export interface DealFilters {
  contactId?: string;
  leadId?: string;
  assignedToId?: string;
  stages?: DealStage[];
}

export interface CreateDealPayload {
  id?: string;
  title: string;
  value: number;
  stage: DealStage;
  lead_id?: string;
  contact_id: string;
  telemarketer_id?: string;
  assigned_to_id?: string;
  expected_close_date?: string;
  lost_reason?: string;
  closed_at?: string;
  insurer?: string;
  insurer_ref?: string;
  submitted_at?: string;
  policy_number?: string;
  financial_goal?: FinancialGoal;
  risk_tolerance?: RiskTolerance;
  investment_horizon?: InvestmentHorizon;
  monthly_investable?: number;
  existing_investments?: string;
  fact_find_notes?: string;
  fact_find_done?: boolean;
  created_by: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface UpdateDealPayload {
  title?: string;
  value?: number;
  stage?: DealStage;
  lead_id?: string;
  contact_id?: string;
  telemarketer_id?: string;
  assigned_to_id?: string;
  expected_close_date?: string;
  lost_reason?: string;
  closed_at?: string;
  insurer?: string;
  insurer_ref?: string;
  submitted_at?: string;
  policy_number?: string;
  financial_goal?: FinancialGoal;
  risk_tolerance?: RiskTolerance;
  investment_horizon?: InvestmentHorizon;
  monthly_investable?: number;
  existing_investments?: string;
  fact_find_notes?: string;
  fact_find_done?: boolean;
  deleted_at?: string;
}

export interface CreateDealProposalPayload {
  deal_id: string;
  name: string;
  status: DealProposalStatus;
  total_value: number;
  notes?: string;
  lines: DealProposalLine[];
  created_by: string;
}

export interface UpdateDealProposalPayload {
  name?: string;
  status?: DealProposalStatus;
  total_value?: number;
  notes?: string;
  lines?: DealProposalLine[];
}

function asNumber(value: number | string | null): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapDealRow(row: DealRow): Deal {
  return {
    id: row.id,
    title: row.title,
    value: asNumber(row.value) ?? 0,
    stage: row.stage,
    lead_id: row.lead_id ?? undefined,
    contact_id: row.contact_id,
    telemarketer_id: row.telemarketer_id ?? undefined,
    assigned_to_id: row.assigned_to_id ?? undefined,
    expected_close_date: row.expected_close_date ?? undefined,
    lost_reason: row.lost_reason ?? undefined,
    closed_at: row.closed_at ?? undefined,
    insurer: row.insurer ?? undefined,
    insurer_ref: row.insurer_ref ?? undefined,
    submitted_at: row.submitted_at ?? undefined,
    policy_number: row.policy_number ?? undefined,
    financial_goal: row.financial_goal ?? undefined,
    risk_tolerance: row.risk_tolerance ?? undefined,
    investment_horizon: row.investment_horizon ?? undefined,
    monthly_investable: asNumber(row.monthly_investable),
    existing_investments: row.existing_investments ?? undefined,
    fact_find_notes: row.fact_find_notes ?? undefined,
    fact_find_done: row.fact_find_done ?? undefined,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? undefined,
  };
}

function mapDealProposalLineRow(row: DealProposalLineRow): DealProposalLine {
  return {
    id: row.id,
    fund_isin: row.fund_isin,
    fund_name: row.fund_name,
    risk_rating: row.risk_rating,
    allocation_pct: asNumber(row.allocation_pct) ?? 0,
  };
}

function mapDealProposalRow(
  row: DealProposalRow,
  lines: DealProposalLineRow[],
): DealProposal {
  return {
    id: row.id,
    deal_id: row.deal_id,
    name: row.name,
    status: row.status,
    total_value: asNumber(row.total_value) ?? 0,
    notes: row.notes ?? undefined,
    lines: lines
      .filter((line) => line.proposal_id === row.id)
      .map(mapDealProposalLineRow),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapStageHistoryRow(row: StageHistoryRow): StageHistoryEntry {
  return {
    id: row.id,
    deal_id: row.deal_id,
    from_stage: row.from_stage,
    to_stage: row.to_stage,
    changed_by: row.changed_by,
    note: row.note ?? undefined,
    created_at: row.created_at,
  };
}

export async function fetchDeals(filters?: DealFilters): Promise<Deal[]> {
  let query = supabase
    .from("deals")
    .select(DEAL_SELECT)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (filters?.contactId) query = query.eq("contact_id", filters.contactId);
  if (filters?.leadId) query = query.eq("lead_id", filters.leadId);
  if (filters?.assignedToId) query = query.eq("assigned_to_id", filters.assignedToId);
  if (filters?.stages?.length) query = query.in("stage", filters.stages);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as unknown as DealRow[]).map(mapDealRow);
}

export async function fetchDealById(id: string): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .select(DEAL_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) throw new Error(error.message);
  return mapDealRow(data as unknown as DealRow);
}

export async function createDeal(payload: CreateDealPayload): Promise<Deal> {
  const now = new Date().toISOString();
  const dealId = payload.id ?? `deal-${nanoid(8)}`;
  const insertPayload = {
    id: dealId,
    title: payload.title,
    value: payload.value,
    stage: payload.stage,
    lead_id: payload.lead_id || null,
    contact_id: payload.contact_id,
    telemarketer_id: payload.telemarketer_id || null,
    assigned_to_id: payload.assigned_to_id || null,
    expected_close_date: payload.expected_close_date || null,
    lost_reason: payload.lost_reason || null,
    closed_at: payload.closed_at || null,
    insurer: payload.insurer || null,
    insurer_ref: payload.insurer_ref || null,
    submitted_at: payload.submitted_at || null,
    policy_number: payload.policy_number || null,
    financial_goal: payload.financial_goal || null,
    risk_tolerance: payload.risk_tolerance || null,
    investment_horizon: payload.investment_horizon || null,
    monthly_investable: payload.monthly_investable ?? null,
    existing_investments: payload.existing_investments || null,
    fact_find_notes: payload.fact_find_notes || null,
    fact_find_done: payload.fact_find_done ?? false,
    created_by: payload.created_by,
    created_at: payload.created_at ?? now,
    updated_at: payload.updated_at ?? now,
    deleted_at: payload.deleted_at || null,
  };

  const { data, error } = await supabase
    .from("deals")
    .insert(insertPayload)
    .select(DEAL_SELECT)
    .single();

  if (error) throw new Error(error.message);

  const { error: historyError } = await supabase
    .from("stage_history")
    .insert({
      id: `sh-${nanoid(8)}`,
      deal_id: dealId,
      from_stage: null,
      to_stage: payload.stage,
      changed_by: payload.created_by,
      created_at: payload.created_at ?? now,
    })
    .select("id")
    .single();

  if (historyError) throw new Error(historyError.message);
  return mapDealRow(data as unknown as DealRow);
}

export async function updateDeal(id: string, payload: UpdateDealPayload): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .update({
      ...payload,
      lead_id: payload.lead_id === "" ? null : payload.lead_id,
      telemarketer_id: payload.telemarketer_id === "" ? null : payload.telemarketer_id,
      assigned_to_id: payload.assigned_to_id === "" ? null : payload.assigned_to_id,
      expected_close_date: payload.expected_close_date === "" ? null : payload.expected_close_date,
      lost_reason: payload.lost_reason === "" ? null : payload.lost_reason,
      closed_at: payload.closed_at === "" ? null : payload.closed_at,
      insurer: payload.insurer === "" ? null : payload.insurer,
      insurer_ref: payload.insurer_ref === "" ? null : payload.insurer_ref,
      submitted_at: payload.submitted_at === "" ? null : payload.submitted_at,
      policy_number: payload.policy_number === "" ? null : payload.policy_number,
      financial_goal: payload.financial_goal ?? null,
      risk_tolerance: payload.risk_tolerance ?? null,
      investment_horizon: payload.investment_horizon ?? null,
      existing_investments: payload.existing_investments === "" ? null : payload.existing_investments,
      fact_find_notes: payload.fact_find_notes === "" ? null : payload.fact_find_notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(DEAL_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapDealRow(data as unknown as DealRow);
}

export async function deleteDeal(id: string): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(DEAL_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapDealRow(data as unknown as DealRow);
}

export async function moveDealStage(
  dealId: string,
  toStage: DealStage,
  note: string | undefined,
  userId: string,
  lostReason?: string,
): Promise<Deal> {
  const current = await fetchDealById(dealId);
  const now = new Date().toISOString();
  const updates: UpdateDealPayload = {
    stage: toStage,
    lost_reason: toStage === "LOST" ? lostReason : current.lost_reason,
    closed_at: toStage === "LOST" || toStage === "WON" ? now : current.closed_at,
    submitted_at: toStage === "SUBMITTED" ? now : current.submitted_at,
  };

  const updated = await updateDeal(dealId, updates);

  const { error } = await supabase
    .from("stage_history")
    .insert({
      id: `sh-${nanoid(8)}`,
      deal_id: dealId,
      from_stage: current.stage,
      to_stage: toStage,
      changed_by: userId,
      note: note || null,
      created_at: now,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return updated;
}

export async function releaseDeal(
  dealId: string,
  releaserId: string,
  transferToId?: string,
): Promise<void> {
  const { error } = await supabase.rpc("release_deal", {
    p_deal_id: dealId,
    p_releaser_id: releaserId,
    p_transfer_to: transferToId ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function fetchDealProposals(dealId: string): Promise<DealProposal[]> {
  const { data: proposals, error: proposalError } = await supabase
    .from("deal_proposals")
    .select(DEAL_PROPOSAL_SELECT)
    .eq("deal_id", dealId)
    .order("updated_at", { ascending: false });

  if (proposalError) throw new Error(proposalError.message);

  const proposalIds = (proposals as DealProposalRow[]).map((proposal) => proposal.id);
  if (proposalIds.length === 0) return [];

  const { data: lines, error: lineError } = await supabase
    .from("deal_proposal_lines")
    .select(DEAL_PROPOSAL_LINE_SELECT)
    .in("proposal_id", proposalIds)
    .order("fund_name");

  if (lineError) throw new Error(lineError.message);

  return (proposals as DealProposalRow[]).map((proposal) =>
    mapDealProposalRow(proposal, lines as DealProposalLineRow[]),
  );
}

export async function createDealProposal(
  payload: CreateDealProposalPayload,
): Promise<DealProposal> {
  const proposalId = `prop-${nanoid(8)}`;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("deal_proposals")
    .insert({
      id: proposalId,
      deal_id: payload.deal_id,
      name: payload.name,
      status: payload.status,
      total_value: payload.total_value,
      notes: payload.notes || null,
      created_by: payload.created_by,
      created_at: now,
      updated_at: now,
    })
    .select(DEAL_PROPOSAL_SELECT)
    .single();

  if (error) throw new Error(error.message);

  const lineRows = payload.lines.map((line) => ({
    id: line.id || `pl-${nanoid(8)}`,
    proposal_id: proposalId,
    fund_isin: line.fund_isin,
    fund_name: line.fund_name,
    risk_rating: line.risk_rating,
    allocation_pct: line.allocation_pct,
  }));

  if (lineRows.length > 0) {
    const { error: lineError } = await supabase
      .from("deal_proposal_lines")
      .insert(lineRows)
      .select("id");

    if (lineError) throw new Error(lineError.message);
  }

  return mapDealProposalRow(
    data as DealProposalRow,
    lineRows as DealProposalLineRow[],
  );
}

export async function updateDealProposal(
  id: string,
  payload: UpdateDealProposalPayload,
): Promise<DealProposal> {
  const updatePayload = {
    ...payload,
    notes: payload.notes === "" ? null : payload.notes,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("deal_proposals")
    .update(updatePayload)
    .eq("id", id)
    .select(DEAL_PROPOSAL_SELECT)
    .single();

  if (error) throw new Error(error.message);

  if (payload.lines) {
    const { error: deleteError } = await supabase
      .from("deal_proposal_lines")
      .delete()
      .eq("proposal_id", id)
      .select("id");

    if (deleteError) throw new Error(deleteError.message);

    if (payload.lines.length > 0) {
      const { error: insertError } = await supabase
        .from("deal_proposal_lines")
        .insert(
          payload.lines.map((line) => ({
            id: line.id || `pl-${nanoid(8)}`,
            proposal_id: id,
            fund_isin: line.fund_isin,
            fund_name: line.fund_name,
            risk_rating: line.risk_rating,
            allocation_pct: line.allocation_pct,
          })),
        )
        .select("id");

      if (insertError) throw new Error(insertError.message);
    }
  }

  const lines = payload.lines
    ? payload.lines.map((line) => ({
        id: line.id || `pl-${nanoid(8)}`,
        proposal_id: id,
        fund_isin: line.fund_isin,
        fund_name: line.fund_name,
        risk_rating: line.risk_rating,
        allocation_pct: line.allocation_pct,
      }))
    : ((await supabase
        .from("deal_proposal_lines")
        .select(DEAL_PROPOSAL_LINE_SELECT)
        .eq("proposal_id", id)).data as DealProposalLineRow[] | null) ?? [];

  return mapDealProposalRow(data as DealProposalRow, lines as DealProposalLineRow[]);
}

export async function deleteDealProposal(id: string): Promise<void> {
  const { error } = await supabase
    .from("deal_proposals")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
}

export async function fetchStageHistory(dealId: string): Promise<StageHistoryEntry[]> {
  const { data, error } = await supabase
    .from("stage_history")
    .select(STAGE_HISTORY_SELECT)
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as StageHistoryRow[]).map(mapStageHistoryRow);
}

export async function convertLead(
  leadId: string,
  contactData: Record<string, unknown>,
  dealData: Record<string, unknown> | null,
  userId: string,
): Promise<{ contact_id: string; deal_id: string | null }> {
  const { data, error } = await supabase.rpc("convert_lead", {
    p_lead_id: leadId,
    p_contact: contactData,
    p_deal: dealData,
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);
  return data as { contact_id: string; deal_id: string | null };
}
