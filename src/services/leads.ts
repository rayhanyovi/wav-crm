import { supabase } from "@/lib/supabase";
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

const LEAD_COLS = `
  id, salutation, first_name, last_name, email, phone,
  age, gender, residential_status, income_range, zipcode,
  source, status, personality, preferred_contact_method, best_time_to_call,
  notes, appointment_date, appointment_time, appointment_result,
  is_abandoned, abandoned_at, other_status_note, products_discussed,
  assigned_to_id, telemarketer_owner_id, adviser_owner_id,
  bounce_count, last_bounced_at, converted_contact_id, converted_at,
  created_by, created_at, updated_at, deleted_at
`.trim();

const LEAD_NOTE_COLS = "id, lead_id, content, created_by, created_at";

// ─── Mapper ───────────────────────────────────────────────────────────────────

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

// ─── Leads ───────────────────────────────────────────────────────────────────

export async function fetchLeads(filters?: LeadFilters): Promise<Lead[]> {
  let q = supabase.from("leads").select(LEAD_COLS);

  if (!filters?.includeDeleted) q = q.is("deleted_at", null);
  if (!filters?.includeAbandoned) q = q.neq("is_abandoned", true);
  if (filters?.status && filters.status !== "ALL") q = q.eq("status", filters.status);
  if (filters?.source && filters.source !== "ALL") q = q.eq("source", filters.source);
  if (filters?.assigned_to_id && filters.assigned_to_id !== "ALL")
    q = q.eq("assigned_to_id", filters.assigned_to_id);
  if (filters?.search) {
    const s = `%${filters.search}%`;
    q = q.or(`first_name.ilike.${s},last_name.ilike.${s},phone.ilike.${s},email.ilike.${s}`);
  }

  q = q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLeadRow);
}

export async function fetchLeadById(id: string): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLS)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return mapLeadRow(data);
}

export async function createLead(payload: CreateLeadPayload): Promise<Lead> {
  const id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabase
    .from("leads")
    .insert({ id, ...payload })
    .select(LEAD_COLS)
    .single();

  if (error) throw new Error(error.message);
  return mapLeadRow(data);
}

export async function updateLead(
  id: string,
  payload: UpdateLeadPayload,
  userId: string,
): Promise<Lead> {
  // Use rpc_update_lead so that app.crm_user_id is set *in the same DB transaction*
  // as the UPDATE — this satisfies the NOT NULL constraint on lead_status_history.changed_by
  // that the fn_lead_status_side_effects trigger writes whenever status changes.
  const { data, error } = await supabase.rpc("rpc_update_lead", {
    p_id: id,
    p_payload: payload,
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);
  return mapLeadRow(data as Record<string, unknown>);
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// ─── RPC operations ──────────────────────────────────────────────────────────

export async function claimLead(leadId: string, userId: string): Promise<{ new_balance: number }> {
  const { data, error } = await supabase.rpc("claim_lead", {
    p_lead_id: leadId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data as { new_balance: number };
}

export async function returnLead(leadId: string, userId: string): Promise<{ new_balance: number }> {
  const { data, error } = await supabase.rpc("return_lead", {
    p_lead_id: leadId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data as { new_balance: number };
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
    assigned_to_id: string;
    created_by: string;
    contact_id: string;
  } | null;
}

export async function convertLead(
  leadId: string,
  payload: ConvertLeadPayload,
  userId: string
): Promise<{ contact_id: string; deal_id: string | null }> {
  const { data, error } = await supabase.rpc("convert_lead", {
    p_lead_id: leadId,
    p_contact: payload.contact,
    p_deal: payload.deal ?? null,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data as { contact_id: string; deal_id: string | null };
}

// ─── Lead Notes ──────────────────────────────────────────────────────────────

export async function fetchLeadNotes(leadId: string): Promise<LeadNote[]> {
  const { data, error } = await supabase
    .from("lead_notes")
    .select(LEAD_NOTE_COLS)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addLeadNote(
  leadId: string,
  content: string,
  createdBy: string
): Promise<LeadNote> {
  const { data, error } = await supabase
    .from("lead_notes")
    .insert({ lead_id: leadId, content, created_by: createdBy })
    .select(LEAD_NOTE_COLS)
    .single();

  if (error) throw new Error(error.message);
  return data as LeadNote;
}

export async function deleteLeadNote(noteId: string): Promise<void> {
  const { error } = await supabase.from("lead_notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
}

// ─── Bulk import ──────────────────────────────────────────────────────────────

export async function bulkCreateLeads(leads: CreateLeadPayload[]): Promise<Lead[]> {
  const rows = leads.map((l) => ({
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...l,
  }));

  const { data, error } = await supabase
    .from("leads")
    .insert(rows)
    .select(LEAD_COLS);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLeadRow);
}
