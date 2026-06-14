import { supabase } from "@/lib/supabase";
import { api, asNumber, type Envelope, type Page } from "@/lib/api";
import type { Contact, ContactNote, LeadSource, FactFindFields } from "@/data/types";

// ─── Kept for callers ─────────────────────────────────────────────────────────

export interface ContactFilters {
  createdBy?: string;
  ids?: string[];
}

export interface CreateContactPayload extends FactFindFields {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  title?: string;
  source: LeadSource;
  created_by: string;
}

export interface UpdateContactPayload extends FactFindFields {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  source?: LeadSource;
}

// ─── API response shapes ──────────────────────────────────────────────────────

interface ApiContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  source: LeadSource;
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

interface ApiContactNote {
  id: string;
  contactId: string;
  content: string;
  createdBy: string;
  createdAt: string;
}

function mapContact(r: ApiContact): Contact {
  return {
    id: r.id,
    first_name: r.firstName,
    last_name: r.lastName,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    title: r.title ?? undefined,
    source: r.source,
    financial_goal: (r.financialGoal as Contact["financial_goal"]) ?? undefined,
    risk_tolerance: (r.riskTolerance as Contact["risk_tolerance"]) ?? undefined,
    investment_horizon: (r.investmentHorizon as Contact["investment_horizon"]) ?? undefined,
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

function mapContactNote(r: ApiContactNote): ContactNote {
  return {
    id: r.id,
    contact_id: r.contactId,
    content: r.content,
    created_by: r.createdBy,
    created_at: r.createdAt,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function fetchContacts(filters?: ContactFilters): Promise<Contact[]> {
  const res = await api.get<Page<ApiContact>>("/api/contacts", { page: 1, pageSize: 500 });
  let contacts = res.data.map(mapContact);
  if (filters?.ids?.length) contacts = contacts.filter((c) => filters.ids!.includes(c.id));
  if (filters?.createdBy) contacts = contacts.filter((c) => c.created_by === filters.createdBy);
  return contacts;
}

export async function fetchContactById(id: string): Promise<Contact> {
  const res = await api.get<Envelope<ApiContact>>(`/api/contacts/${id}`);
  return mapContact(res.data);
}

export async function createContact(payload: CreateContactPayload): Promise<Contact> {
  const res = await api.post<Envelope<ApiContact>>("/api/contacts", {
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    phone: payload.phone,
    title: payload.title,
    source: payload.source,
    financial_goal: payload.financial_goal,
    risk_tolerance: payload.risk_tolerance,
    investment_horizon: payload.investment_horizon,
    monthly_investable: payload.monthly_investable,
    existing_investments: payload.existing_investments,
    fact_find_notes: payload.fact_find_notes,
    fact_find_done: payload.fact_find_done,
  });
  return mapContact(res.data);
}

export async function updateContact(id: string, payload: UpdateContactPayload): Promise<Contact> {
  const res = await api.patch<Envelope<ApiContact>>(`/api/contacts/${id}`, {
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    phone: payload.phone,
    title: payload.title,
    source: payload.source,
    financial_goal: payload.financial_goal,
    risk_tolerance: payload.risk_tolerance,
    investment_horizon: payload.investment_horizon,
    monthly_investable: payload.monthly_investable,
    existing_investments: payload.existing_investments,
    fact_find_notes: payload.fact_find_notes,
    fact_find_done: payload.fact_find_done,
  });
  return mapContact(res.data);
}

export async function deleteContact(id: string): Promise<Contact> {
  const contact = await fetchContactById(id);
  await api.delete(`/api/contacts/${id}`);
  return contact;
}

export async function fetchContactNotes(contactId: string): Promise<ContactNote[]> {
  const res = await api.get<Envelope<ApiContactNote[]>>(`/api/contacts/${contactId}/notes`);
  return res.data.map(mapContactNote);
}

export async function addContactNote(
  contactId: string,
  content: string,
  _userId?: string,
): Promise<ContactNote> {
  const res = await api.post<Envelope<ApiContactNote>>(`/api/contacts/${contactId}/notes`, { content });
  return mapContactNote(res.data);
}

export async function deleteContactNote(id: string): Promise<void> {
  // No API endpoint yet — call Supabase directly.
  const { error } = await supabase.from("contact_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
