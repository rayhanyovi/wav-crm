import { nanoid } from "nanoid";
import { supabase } from "@/lib/supabase";
import type { Contact, ContactNote, LeadSource } from "@/data/types";

const CONTACT_SELECT =
  "id,first_name,last_name,email,phone,title,source,created_by,created_at,updated_at,deleted_at";
const CONTACT_NOTE_SELECT =
  "id,contact_id,content,created_by,created_at";

interface ContactRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  source: LeadSource;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface ContactNoteRow {
  id: string;
  contact_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

export interface ContactFilters {
  createdBy?: string;
  ids?: string[];
}

export interface CreateContactPayload {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  title?: string;
  source: LeadSource;
  created_by: string;
}

export interface UpdateContactPayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  source?: LeadSource;
}

function mapContactRow(row: ContactRow): Contact {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    title: row.title ?? undefined,
    source: row.source,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? undefined,
  };
}

function mapContactNoteRow(row: ContactNoteRow): ContactNote {
  return {
    id: row.id,
    contact_id: row.contact_id,
    content: row.content,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export async function fetchContacts(filters?: ContactFilters): Promise<Contact[]> {
  let query = supabase
    .from("contacts")
    .select(CONTACT_SELECT)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (filters?.createdBy) query = query.eq("created_by", filters.createdBy);
  if (filters?.ids?.length) query = query.in("id", filters.ids);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as ContactRow[]).map(mapContactRow);
}

export async function fetchContactById(id: string): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .select(CONTACT_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) throw new Error(error.message);
  return mapContactRow(data as ContactRow);
}

export async function createContact(payload: CreateContactPayload): Promise<Contact> {
  const insertPayload = {
    id: `cnt-${nanoid(8)}`,
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email || null,
    phone: payload.phone || null,
    title: payload.title || null,
    source: payload.source,
    created_by: payload.created_by,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("contacts")
    .insert(insertPayload)
    .select(CONTACT_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapContactRow(data as ContactRow);
}

export async function updateContact(id: string, payload: UpdateContactPayload): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .update({
      ...payload,
      email: payload.email === "" ? null : payload.email,
      phone: payload.phone === "" ? null : payload.phone,
      title: payload.title === "" ? null : payload.title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(CONTACT_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapContactRow(data as ContactRow);
}

export async function deleteContact(id: string): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(CONTACT_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapContactRow(data as ContactRow);
}

export async function fetchContactNotes(contactId: string): Promise<ContactNote[]> {
  const { data, error } = await supabase
    .from("contact_notes")
    .select(CONTACT_NOTE_SELECT)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as ContactNoteRow[]).map(mapContactNoteRow);
}

export async function addContactNote(
  contactId: string,
  content: string,
  userId: string,
): Promise<ContactNote> {
  const { data, error } = await supabase
    .from("contact_notes")
    .insert({
      id: `cn-${nanoid(8)}`,
      contact_id: contactId,
      content,
      created_by: userId,
      created_at: new Date().toISOString(),
    })
    .select(CONTACT_NOTE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapContactNoteRow(data as ContactNoteRow);
}

export async function deleteContactNote(id: string): Promise<void> {
  const { error } = await supabase
    .from("contact_notes")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
}
