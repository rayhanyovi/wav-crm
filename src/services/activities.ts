import { supabase } from "@/lib/supabase";
import type { Activity, ActivityType, ActivityResult } from "@/data/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityFilters {
  type?: ActivityType | "ALL";
  lead_id?: string;
  contact_id?: string;
  deal_id?: string;
  assigned_to_id?: string | "ALL";
  search?: string;
  includeDeleted?: boolean;
}

export type CreateActivityPayload = Omit<Activity, "id" | "created_at" | "updated_at" | "deleted_at">;
export type UpdateActivityPayload = Partial<Omit<Activity, "id" | "created_at" | "updated_at">>;

export interface Comment {
  id: string;
  activity_id: string;
  text: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const ACTIVITY_COLS = `
  id, type, subject, description, result,
  scheduled_at, completed_at, metadata,
  deal_id, contact_id, lead_id, assigned_to_id,
  created_by, created_at, updated_at, deleted_at
`.trim();

const COMMENT_COLS = "id, activity_id, text, created_by, created_at, updated_at";

// ─── Mapper ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivityRow(row: any): Activity {
  return {
    ...row,
    metadata: row.metadata ?? undefined,
    result: row.result ?? undefined,
    description: row.description ?? undefined,
    scheduled_at: row.scheduled_at ?? undefined,
    completed_at: row.completed_at ?? undefined,
    deal_id: row.deal_id ?? undefined,
    contact_id: row.contact_id ?? undefined,
    lead_id: row.lead_id ?? undefined,
    assigned_to_id: row.assigned_to_id ?? undefined,
    deleted_at: row.deleted_at ?? undefined,
  };
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function fetchActivities(filters?: ActivityFilters): Promise<Activity[]> {
  let q = supabase.from("activities").select(ACTIVITY_COLS);

  if (!filters?.includeDeleted) q = q.is("deleted_at", null);
  if (filters?.type && filters.type !== "ALL") q = q.eq("type", filters.type);
  if (filters?.lead_id) q = q.eq("lead_id", filters.lead_id);
  if (filters?.contact_id) q = q.eq("contact_id", filters.contact_id);
  if (filters?.deal_id) q = q.eq("deal_id", filters.deal_id);
  if (filters?.assigned_to_id && filters.assigned_to_id !== "ALL")
    q = q.eq("assigned_to_id", filters.assigned_to_id);
  if (filters?.search)
    q = q.ilike("subject", `%${filters.search}%`);

  q = q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapActivityRow);
}

export async function fetchActivityById(id: string): Promise<Activity> {
  const { data, error } = await supabase
    .from("activities")
    .select(ACTIVITY_COLS)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return mapActivityRow(data);
}

export async function createActivity(payload: CreateActivityPayload): Promise<Activity> {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabase
    .from("activities")
    .insert({ id, ...payload })
    .select(ACTIVITY_COLS)
    .single();

  if (error) throw new Error(error.message);
  return mapActivityRow(data);
}

export async function updateActivity(id: string, payload: UpdateActivityPayload): Promise<Activity> {
  const { data, error } = await supabase
    .from("activities")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(ACTIVITY_COLS)
    .single();

  if (error) throw new Error(error.message);
  return mapActivityRow(data);
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await supabase
    .from("activities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function completeActivity(
  id: string,
  result: string,
  _userId: string
): Promise<Activity> {
  const { data, error } = await supabase
    .from("activities")
    .update({
      result: result as ActivityResult,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(ACTIVITY_COLS)
    .single();

  if (error) throw new Error(error.message);
  return mapActivityRow(data);
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function fetchComments(activityId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_COLS)
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Comment[];
}

export async function addComment(
  activityId: string,
  text: string,
  createdBy: string
): Promise<Comment> {
  const { data, error } = await supabase
    .from("comments")
    .insert({ activity_id: activityId, text, created_by: createdBy })
    .select(COMMENT_COLS)
    .single();

  if (error) throw new Error(error.message);
  return data as Comment;
}

export async function updateComment(id: string, text: string): Promise<Comment> {
  const { data, error } = await supabase
    .from("comments")
    .update({ text, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COMMENT_COLS)
    .single();

  if (error) throw new Error(error.message);
  return data as Comment;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
