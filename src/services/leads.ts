import { supabase } from "@/lib/supabase";
import { api, asNumber, type Envelope, type Page } from "@/lib/api";
import type { Lead, LeadNote, LeadStatus, LeadSource } from "@/data/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeadFilters {
  status?: LeadStatus | "ALL";
  source?: LeadSource | "ALL";
  assigned_to_id?: string | "ALL";
  search?: string;
  includeDeleted?: boolean;
  includeAbandoned?: boolean;
}

export type CreateLeadPayload = Omit<Lead, "id" | "created_at" | "updated_at" | "deleted_at" | "status_history">;
type LeadPatchFields = Omit<
  Lead,
  | "id"
  | "created_at"
  | "updated_at"
  | "status_history"
  | "callback_at"
  | "callback_assigned_to"
  | "callback_note"
  | "call_attempt_count"
  | "no_answer_count"
  | "last_call_attempt_at"
  | "last_no_answer_at"
>;
export type UpdateLeadPayload = Partial<LeadPatchFields> & {
  callback_at?: string | null;
  callback_assigned_to?: string | null;
  callback_note?: string | null;
};

// ─── API response shape (Prisma camelCase) ────────────────────────────────────

interface ApiLead {
  id: string;
  salutation: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  age: number | null;
  gender: string | null;
  residentialStatus: string | null;
  incomeRange: string | null;
  zipcode: string | null;
  personality: string | null;
  preferredContactMethod: string | null;
  bestTimeToCall: string | null;
  status: LeadStatus;
  source: LeadSource;
  notes: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  appointmentResult: Lead["appointment_result"] | null;
  isAbandoned: boolean;
  abandonedAt: string | null;
  otherStatusNote: string | null;
  productsDiscussed: string[] | null;
  assignedToId: string | null;
  telemarketerOwnerId: string | null;
  adviserOwnerId: string | null;
  bounceCount: number | null;
  lastBouncedAt: string | null;
  convertedContactId: string | null;
  convertedAt: string | null;
  cooldownUntil: string | null;
  lastContactedAt: string | null;
  callAttemptCount: number | null;
  noAnswerCount: number | null;
  lastCallAttemptAt: string | null;
  lastNoAnswerAt: string | null;
  callbackAt: string | null;
  callbackAssignedTo: string | null;
  callbackNote: string | null;
  financialGoal: string | null;
  riskTolerance: string | null;
  investmentHorizon: string | null;
  monthlyInvestable: string | null;
  existingInvestments: string | null;
  factFindNotes: string | null;
  factFindDone: boolean | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiLeadNote {
  id: string;
  leadId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

function mapLead(r: ApiLead): Lead {
  return {
    id: r.id,
    salutation: r.salutation ?? undefined,
    first_name: r.firstName,
    last_name: r.lastName,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    age: r.age ?? undefined,
    gender: r.gender ?? undefined,
    residential_status: r.residentialStatus ?? undefined,
    income_range: r.incomeRange ?? undefined,
    zipcode: r.zipcode ?? undefined,
    personality: r.personality ?? undefined,
    preferred_contact_method: r.preferredContactMethod ?? undefined,
    best_time_to_call: r.bestTimeToCall ?? undefined,
    status: r.status,
    source: r.source,
    notes: r.notes ?? undefined,
    appointment_date: r.appointmentDate ?? undefined,
    appointment_time: r.appointmentTime ?? undefined,
    appointment_result: r.appointmentResult ?? undefined,
    is_abandoned: r.isAbandoned ?? false,
    abandoned_at: r.abandonedAt ?? undefined,
    other_status_note: r.otherStatusNote ?? undefined,
    products_discussed: r.productsDiscussed ?? undefined,
    assigned_to_id: r.assignedToId ?? undefined,
    telemarketer_owner_id: r.telemarketerOwnerId ?? undefined,
    adviser_owner_id: r.adviserOwnerId ?? undefined,
    bounce_count: r.bounceCount ?? undefined,
    last_bounced_at: r.lastBouncedAt ?? undefined,
    converted_contact_id: r.convertedContactId ?? undefined,
    converted_at: r.convertedAt ?? undefined,
    cooldown_until: r.cooldownUntil ?? undefined,
    last_contacted_at: r.lastContactedAt ?? undefined,
    call_attempt_count: r.callAttemptCount ?? undefined,
    no_answer_count: r.noAnswerCount ?? undefined,
    last_call_attempt_at: r.lastCallAttemptAt ?? undefined,
    last_no_answer_at: r.lastNoAnswerAt ?? undefined,
    callback_at: r.callbackAt ?? undefined,
    callback_assigned_to: r.callbackAssignedTo ?? undefined,
    callback_note: r.callbackNote ?? undefined,
    financial_goal: (r.financialGoal as Lead["financial_goal"]) ?? undefined,
    risk_tolerance: (r.riskTolerance as Lead["risk_tolerance"]) ?? undefined,
    investment_horizon: (r.investmentHorizon as Lead["investment_horizon"]) ?? undefined,
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

function mapLeadNote(r: ApiLeadNote): LeadNote {
  return {
    id: r.id,
    lead_id: r.leadId,
    content: r.content,
    created_by: r.createdBy,
    created_at: r.createdAt,
  };
}

// Keep the old Supabase mapper for bulkCreateLeads (no batch API endpoint yet)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapLeadRow(row: any): Lead {
  return {
    ...row,
    age: row.age ?? undefined,
    bounce_count: row.bounce_count ?? undefined,
    call_attempt_count: row.call_attempt_count ?? undefined,
    no_answer_count: row.no_answer_count ?? undefined,
    is_abandoned: row.is_abandoned ?? false,
    products_discussed: row.products_discussed ?? undefined,
  };
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function fetchLeads(filters?: LeadFilters): Promise<Lead[]> {
  const params: Record<string, string | number | boolean | undefined> = {
    page: 1,
    pageSize: 500,
    includeAbandoned: filters?.includeAbandoned,
  };
  if (filters?.status && filters.status !== "ALL") params.status = filters.status;
  if (filters?.source && filters.source !== "ALL") params.source = filters.source;
  if (filters?.search) params.search = filters.search;

  const res = await api.get<Page<ApiLead>>("/api/leads", params);
  return res.data.map(mapLead);
}

export async function fetchLeadById(id: string): Promise<Lead> {
  const res = await api.get<Envelope<ApiLead>>(`/api/leads/${id}`);
  return mapLead(res.data);
}

export async function createLead(payload: CreateLeadPayload): Promise<Lead> {
  const res = await api.post<Envelope<ApiLead>>("/api/leads", {
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    phone: payload.phone,
    source: payload.source ?? "OTHERS",
    status: payload.status ?? "NA",
    notes: payload.notes,
    assigned_to_id: payload.assigned_to_id,
    telemarketer_owner_id: payload.telemarketer_owner_id,
    salutation: payload.salutation,
    age: payload.age,
    gender: payload.gender,
    residential_status: payload.residential_status,
    income_range: payload.income_range,
    zipcode: payload.zipcode,
  });
  return mapLead(res.data);
}

export async function updateLead(
  id: string,
  payload: UpdateLeadPayload,
  _userId?: string,
): Promise<Lead> {
  const res = await api.patch<Envelope<ApiLead>>(`/api/leads/${id}`, payload);
  return mapLead(res.data);
}

export async function deleteLead(id: string): Promise<void> {
  await api.delete(`/api/leads/${id}`);
}

export interface MergeDuplicateLeadsResult {
  lead: Lead;
  merged_source_ids: string[];
  moved: {
    notes: number;
    status_history: number;
    activities: number;
    deals: number;
    credit_transactions: number;
    notifications: number;
  };
}

interface ApiMergeDuplicateLeadsResult {
  lead: ApiLead;
  mergedSourceIds: string[];
  moved: {
    notes: number;
    statusHistory: number;
    activities: number;
    deals: number;
    creditTransactions: number;
    notifications: number;
  };
}

export async function mergeDuplicateLeads(
  targetId: string,
  sourceIds: string[],
): Promise<MergeDuplicateLeadsResult> {
  const res = await api.post<Envelope<ApiMergeDuplicateLeadsResult>>(
    `/api/leads/${targetId}/merge-duplicates`,
    { source_ids: sourceIds },
  );
  return {
    lead: mapLead(res.data.lead),
    merged_source_ids: res.data.mergedSourceIds,
    moved: {
      notes: res.data.moved.notes,
      status_history: res.data.moved.statusHistory,
      activities: res.data.moved.activities,
      deals: res.data.moved.deals,
      credit_transactions: res.data.moved.creditTransactions,
      notifications: res.data.moved.notifications,
    },
  };
}

// ─── RPC-style operations ─────────────────────────────────────────────────────

export async function claimLead(leadId: string, _userId?: string): Promise<{ new_balance: number }> {
  const res = await api.post<Envelope<ApiLead>>(`/api/leads/${leadId}/claim`);
  // Return new balance from the actor's credit (not in the lead row; return 0 as placeholder)
  void res;
  return { new_balance: 0 };
}

export async function claimLeadsForCall(leadIds: string[], _userId?: string): Promise<void> {
  // When we have concrete IDs, ask the server to lock exactly those leads so the
  // queue the TM sees matches what gets soft-locked. Falls back to count-based.
  await api.post("/api/leads/claim-for-call", {
    count: leadIds.length || 15,
    leadIds: leadIds.length ? leadIds : undefined,
  });
}

export async function returnLead(leadId: string, _userId?: string): Promise<{ new_balance: number }> {
  await api.post(`/api/leads/${leadId}/return`);
  return { new_balance: 0 };
}

export interface ConvertLeadPayload {
  contact: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    source?: string;
    created_by: string;
  };
  deal?: {
    title: string;
    value: number;
    stage: string;
    assigned_to_id?: string | null;
    created_by: string;
    contact_id?: string;
  } | null;
  appointment_date?: string;
  appointment_time?: string;
}

export async function convertLead(
  leadId: string,
  payload: ConvertLeadPayload,
  _userId?: string,
): Promise<{ contact_id: string; deal_id: string | null }> {
  const res = await api.post<Envelope<{ lead: ApiLead; contactId: string; dealId: string }>>(`/api/leads/${leadId}/convert`, {
    first_name: payload.contact.first_name,
    last_name: payload.contact.last_name,
    email: payload.contact.email,
    phone: payload.contact.phone,
    appointment_date: payload.appointment_date ?? new Date().toISOString().split("T")[0],
    appointment_time: payload.appointment_time,
    // When set, the backend assigns the new deal to this adviser and spends one
    // of their credits (delegated TM booking on their behalf, or a MASTER booking).
    assigned_adviser_id: payload.deal?.assigned_to_id ?? undefined,
  });
  return { contact_id: res.data.contactId, deal_id: res.data.dealId };
}

// ─── Lead Notes ───────────────────────────────────────────────────────────────

export async function fetchLeadNotes(leadId: string): Promise<LeadNote[]> {
  const res = await api.get<Envelope<ApiLeadNote[]>>(`/api/leads/${leadId}/notes`);
  return res.data.map(mapLeadNote);
}

export async function addLeadNote(
  leadId: string,
  content: string,
  _createdBy?: string,
): Promise<LeadNote> {
  const res = await api.post<Envelope<ApiLeadNote>>(`/api/leads/${leadId}/notes`, { content });
  return mapLeadNote(res.data);
}

export async function deleteLeadNote(noteId: string): Promise<void> {
  // No API endpoint for deleting notes yet — call Supabase directly.
  const { error } = await supabase.from("lead_notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
}

// ─── Bulk import ──────────────────────────────────────────────────────────────

export interface BulkCreateResult {
  created: Lead[];
  failed: { payload: CreateLeadPayload; error: string }[];
}

const BULK_CHUNK_SIZE = 500;

// Sends leads to POST /api/leads/bulk in chunks of 500.
// Returns a synthetic BulkCreateResult (created array is empty — the server
// doesn't return individual lead rows for bulk inserts, only a count).
export async function bulkCreateLeads(
  leads: CreateLeadPayload[],
  onProgress?: (done: number, total: number) => void,
): Promise<BulkCreateResult> {
  let totalCreated = 0;
  const failed: BulkCreateResult["failed"] = [];

  for (let i = 0; i < leads.length; i += BULK_CHUNK_SIZE) {
    const chunk = leads.slice(i, i + BULK_CHUNK_SIZE);
    try {
      const res = await api.post<{ data: { created: number; skipped: number } }>(
        "/api/leads/bulk",
        { leads: chunk },
      );
      totalCreated += res.data.created;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Mark all rows in this chunk as failed
      chunk.forEach((payload) => failed.push({ payload, error: message }));
    }
    onProgress?.(Math.min(i + BULK_CHUNK_SIZE, leads.length), leads.length);
  }

  // created array left empty — callers use .length for counts, not the objects
  return { created: Array(totalCreated).fill(null) as Lead[], failed };
}
