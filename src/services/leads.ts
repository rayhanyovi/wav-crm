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
export type UpdateLeadPayload = Partial<Omit<Lead, "id" | "created_at" | "updated_at" | "status_history">>;

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
  status: LeadStatus;
  source: LeadSource;
  notes: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  isAbandoned: boolean;
  abandonedAt: string | null;
  otherStatusNote: string | null;
  assignedToId: string | null;
  telemarketerOwnerId: string | null;
  adviserOwnerId: string | null;
  bounceCount: number | null;
  convertedContactId: string | null;
  convertedAt: string | null;
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
    status: r.status,
    source: r.source,
    notes: r.notes ?? undefined,
    appointment_date: r.appointmentDate ?? undefined,
    appointment_time: r.appointmentTime ?? undefined,
    is_abandoned: r.isAbandoned ?? false,
    abandoned_at: r.abandonedAt ?? undefined,
    other_status_note: r.otherStatusNote ?? undefined,
    assigned_to_id: r.assignedToId ?? undefined,
    telemarketer_owner_id: r.telemarketerOwnerId ?? undefined,
    adviser_owner_id: r.adviserOwnerId ?? undefined,
    bounce_count: r.bounceCount ?? undefined,
    converted_contact_id: r.convertedContactId ?? undefined,
    converted_at: r.convertedAt ?? undefined,
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

// ─── RPC-style operations ─────────────────────────────────────────────────────

export async function claimLead(leadId: string, _userId?: string): Promise<{ new_balance: number }> {
  const res = await api.post<Envelope<ApiLead>>(`/api/leads/${leadId}/claim`);
  // Return new balance from the actor's credit (not in the lead row; return 0 as placeholder)
  void res;
  return { new_balance: 0 };
}

export async function claimLeadsForCall(_leadIds: string[], _userId?: string): Promise<void> {
  await api.post("/api/leads/claim-for-call", { count: _leadIds.length || 15 });
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

// ─── Bulk import (no batch API endpoint — falls back to sequential creates) ───

export async function bulkCreateLeads(leads: CreateLeadPayload[]): Promise<Lead[]> {
  return Promise.all(leads.map((l) => createLead(l)));
}
