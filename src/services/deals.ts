import { api, asNumber, type Envelope, type Page } from "@/lib/api";
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

// ─── API response shapes (Prisma camelCase) ───────────────────────────────────

interface ApiDeal {
  id: string;
  title: string;
  value: string | number;
  stage: DealStage;
  leadId: string | null;
  contactId: string;
  telemarketerId: string | null;
  assignedToId: string | null;
  expectedCloseDate: string | null;
  lostReason: string | null;
  closedAt: string | null;
  insurer: string | null;
  insurerRef: string | null;
  submittedAt: string | null;
  policyNumber: string | null;
  financialGoal: FinancialGoal | null;
  riskTolerance: RiskTolerance | null;
  investmentHorizon: InvestmentHorizon | null;
  monthlyInvestable: string | number | null;
  existingInvestments: string | null;
  factFindNotes: string | null;
  factFindDone: boolean | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiProposal {
  id: string;
  dealId: string;
  name: string;
  status: DealProposalStatus;
  totalValue: string | number;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lines: ApiProposalLine[];
}

interface ApiProposalLine {
  id: string;
  proposalId: string;
  fundIsin: string;
  fundName: string;
  riskRating: number;
  allocationPct: string | number;
}

interface ApiStageHistory {
  id: string;
  dealId: string;
  fromStage: DealStage | null;
  toStage: DealStage;
  changedBy: string;
  note: string | null;
  createdAt: string;
}

// ─── Filters / payloads (kept for backward compat with callers) ───────────────

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
  assigned_to_id?: string | null;
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

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapDeal(r: ApiDeal): Deal {
  return {
    id: r.id,
    title: r.title,
    value: asNumber(r.value) ?? 0,
    stage: r.stage,
    lead_id: r.leadId ?? undefined,
    contact_id: r.contactId,
    telemarketer_id: r.telemarketerId ?? undefined,
    assigned_to_id: r.assignedToId ?? undefined,
    expected_close_date: r.expectedCloseDate ?? undefined,
    lost_reason: r.lostReason ?? undefined,
    closed_at: r.closedAt ?? undefined,
    insurer: r.insurer ?? undefined,
    insurer_ref: r.insurerRef ?? undefined,
    submitted_at: r.submittedAt ?? undefined,
    policy_number: r.policyNumber ?? undefined,
    financial_goal: r.financialGoal ?? undefined,
    risk_tolerance: r.riskTolerance ?? undefined,
    investment_horizon: r.investmentHorizon ?? undefined,
    monthly_investable: asNumber(r.monthlyInvestable),
    existing_investments: r.existingInvestments ?? undefined,
    fact_find_notes: r.factFindNotes ?? undefined,
    fact_find_done: r.factFindDone ?? undefined,
    created_by: r.createdBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    deleted_at: r.deletedAt ?? undefined,
  };
}

function mapProposalLine(r: ApiProposalLine): DealProposalLine {
  return {
    id: r.id,
    fund_isin: r.fundIsin,
    fund_name: r.fundName,
    risk_rating: r.riskRating,
    allocation_pct: asNumber(r.allocationPct) ?? 0,
  };
}

function mapProposal(r: ApiProposal): DealProposal {
  return {
    id: r.id,
    deal_id: r.dealId,
    name: r.name,
    status: r.status,
    total_value: asNumber(r.totalValue) ?? 0,
    notes: r.notes ?? undefined,
    lines: (r.lines ?? []).map(mapProposalLine),
    created_by: r.createdBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

function mapStageHistory(r: ApiStageHistory): StageHistoryEntry {
  return {
    id: r.id,
    deal_id: r.dealId,
    from_stage: r.fromStage,
    to_stage: r.toStage,
    changed_by: r.changedBy,
    note: r.note ?? undefined,
    created_at: r.createdAt,
  };
}

// ─── Deal CRUD ────────────────────────────────────────────────────────────────

export async function fetchDeals(filters?: DealFilters): Promise<Deal[]> {
  const params: Record<string, string | number | boolean | undefined> = {
    page: 1,
    pageSize: 500,
  };
  if (filters?.stages?.length === 1) params.stage = filters.stages[0];

  const res = await api.get<Page<ApiDeal>>("/api/deals", params);
  let deals = res.data.map(mapDeal);

  // Client-side filter for multi-stage, contactId, leadId, assignedToId
  // (server only supports a single stage param)
  if (filters?.stages && filters.stages.length > 1) {
    deals = deals.filter((d) => filters.stages!.includes(d.stage));
  }
  if (filters?.contactId) deals = deals.filter((d) => d.contact_id === filters.contactId);
  if (filters?.leadId) deals = deals.filter((d) => d.lead_id === filters.leadId);
  if (filters?.assignedToId) deals = deals.filter((d) => d.assigned_to_id === filters.assignedToId);

  return deals;
}

export async function fetchDealById(id: string): Promise<Deal> {
  const res = await api.get<Envelope<ApiDeal>>(`/api/deals/${id}`);
  return mapDeal(res.data);
}

export async function createDeal(payload: CreateDealPayload): Promise<Deal> {
  const res = await api.post<Envelope<ApiDeal>>("/api/deals", {
    title: payload.title,
    value: payload.value,
    contact_id: payload.contact_id,
    lead_id: payload.lead_id,
    telemarketer_id: payload.telemarketer_id,
    assigned_to_id: payload.assigned_to_id,
  });
  return mapDeal(res.data);
}

export async function updateDeal(id: string, payload: UpdateDealPayload): Promise<Deal> {
  // Stage changes must go through moveDealStage — strip stage from general updates
  const { stage, lost_reason, closed_at, submitted_at, insurer, insurer_ref, policy_number, ...rest } = payload;
  void stage; void lost_reason; void closed_at; void submitted_at; void insurer; void insurer_ref; void policy_number;

  const res = await api.patch<Envelope<ApiDeal>>(`/api/deals/${id}`, {
    title: rest.title,
    value: rest.value,
    expected_close_date: rest.expected_close_date,
    financial_goal: rest.financial_goal,
    risk_tolerance: rest.risk_tolerance,
    investment_horizon: rest.investment_horizon,
    monthly_investable: rest.monthly_investable,
    existing_investments: rest.existing_investments,
    fact_find_notes: rest.fact_find_notes,
    fact_find_done: rest.fact_find_done,
  });
  return mapDeal(res.data);
}

export async function deleteDeal(id: string): Promise<Deal> {
  await api.delete(`/api/deals/${id}`);
  // Return a minimal Deal shape — callers typically don't use the return value
  return fetchDealById(id).catch(() => ({ id } as Deal));
}

export async function moveDealStage(
  dealId: string,
  toStage: DealStage,
  note: string | undefined,
  _userId: string,
  lostReason?: string,
  insurer?: string,
  insurerRef?: string,
  policyNumber?: string,
): Promise<Deal> {
  const res = await api.post<Envelope<ApiDeal>>(`/api/deals/${dealId}/stage`, {
    to_stage: toStage,
    note,
    lost_reason: lostReason,
    insurer,
    insurer_ref: insurerRef,
    policy_number: policyNumber,
  });
  return mapDeal(res.data);
}

export async function releaseDeal(dealId: string, _releaserId?: string, _transferToId?: string): Promise<void> {
  await api.post(`/api/deals/${dealId}/release`);
}

// ─── Proposals ────────────────────────────────────────────────────────────────

export async function fetchDealProposals(dealId: string): Promise<DealProposal[]> {
  const res = await api.get<Envelope<ApiProposal[]>>(`/api/deals/${dealId}/proposals`);
  return res.data.map(mapProposal);
}

export async function createDealProposal(payload: CreateDealProposalPayload): Promise<DealProposal> {
  const res = await api.post<Envelope<ApiProposal>>(`/api/deals/${payload.deal_id}/proposals`, {
    name: payload.name,
    notes: payload.notes,
  });
  // Add lines sequentially
  const proposal = mapProposal(res.data);
  for (const line of payload.lines) {
    await api.post(`/api/deals/${payload.deal_id}/proposals/${proposal.id}/lines`, {
      fund_isin: line.fund_isin,
      fund_name: line.fund_name,
      risk_rating: line.risk_rating,
      allocation_pct: line.allocation_pct,
    });
  }
  // Refetch to get lines included
  const proposals = await fetchDealProposals(payload.deal_id);
  return proposals.find((p) => p.id === proposal.id) ?? proposal;
}

export async function updateDealProposal(id: string, payload: UpdateDealProposalPayload): Promise<DealProposal> {
  // We need the dealId — fetch all proposals to find it
  // This is a limitation of the current API design; callers typically know the dealId
  throw new Error("Use updateDealProposalForDeal(dealId, proposalId, payload) instead");
}

/** Updated signature that requires dealId (use this instead of updateDealProposal). */
export async function updateDealProposalForDeal(
  dealId: string,
  proposalId: string,
  payload: UpdateDealProposalPayload,
): Promise<DealProposal> {
  const res = await api.patch<Envelope<ApiProposal>>(
    `/api/deals/${dealId}/proposals/${proposalId}`,
    {
      name: payload.name,
      status: payload.status,
      notes: payload.notes,
    },
  );
  return mapProposal(res.data);
}

export async function deleteDealProposal(_id: string): Promise<void> {
  // No DELETE /api/deals/:id/proposals/:proposalId endpoint yet — no-op
  console.warn("deleteDealProposal: no API endpoint yet");
}

// ─── Stage history ────────────────────────────────────────────────────────────

export async function fetchStageHistory(dealId: string): Promise<StageHistoryEntry[]> {
  const res = await api.get<Envelope<ApiStageHistory[]>>(`/api/deals/${dealId}/stage-history`);
  return res.data.map(mapStageHistory);
}

// ─── Lead convert (kept here for backward compat with existing callers) ───────

export async function convertLead(
  leadId: string,
  _contactData: Record<string, unknown>,
  _dealData: Record<string, unknown> | null,
  _userId: string,
): Promise<{ contact_id: string; deal_id: string | null }> {
  const res = await api.post<Envelope<{ lead: ApiDeal; contactId: string; dealId: string }>>(
    `/api/leads/${leadId}/convert`,
    {
      first_name: _contactData["first_name"] as string,
      last_name: (_contactData["last_name"] as string) ?? "-",
      email: _contactData["email"],
      phone: _contactData["phone"],
      appointment_date:
        (_dealData?.["appointment_date"] as string) ?? new Date().toISOString().split("T")[0],
    },
  );
  return { contact_id: res.data.contactId, deal_id: res.data.dealId };
}
