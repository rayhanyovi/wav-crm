import { api, type Envelope, type Page } from "@/lib/api";
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

// ─── API response shapes ──────────────────────────────────────────────────────

interface ApiActivity {
  id: string;
  type: ActivityType;
  subject: string;
  description: string | null;
  result: ActivityResult | null;
  scheduledAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  dealId: string | null;
  contactId: string | null;
  leadId: string | null;
  assignedToId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiComment {
  id: string;
  activityId: string;
  text: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function mapActivity(r: ApiActivity): Activity {
  return {
    id: r.id,
    type: r.type,
    subject: r.subject,
    description: r.description ?? undefined,
    result: r.result ?? undefined,
    scheduled_at: r.scheduledAt ?? undefined,
    completed_at: r.completedAt ?? undefined,
    metadata: r.metadata,
    deal_id: r.dealId ?? undefined,
    contact_id: r.contactId ?? undefined,
    lead_id: r.leadId ?? undefined,
    assigned_to_id: r.assignedToId ?? undefined,
    created_by: r.createdBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    deleted_at: r.deletedAt ?? undefined,
  };
}

function mapComment(r: ApiComment): Comment {
  return {
    id: r.id,
    activity_id: r.activityId,
    text: r.text,
    created_by: r.createdBy,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function fetchActivities(filters?: ActivityFilters): Promise<Activity[]> {
  const params: Record<string, string | number | boolean | undefined> = {
    page: 1,
    pageSize: 500,
  };
  if (filters?.type && filters.type !== "ALL") params.type = filters.type;
  if (filters?.lead_id) params.lead_id = filters.lead_id;
  if (filters?.contact_id) params.contact_id = filters.contact_id;
  if (filters?.deal_id) params.deal_id = filters.deal_id;

  const res = await api.get<Page<ApiActivity>>("/api/activities", params);
  let activities = res.data.map(mapActivity);

  if (filters?.assigned_to_id && filters.assigned_to_id !== "ALL") {
    activities = activities.filter((a) => a.assigned_to_id === filters.assigned_to_id);
  }

  return activities;
}

export async function fetchActivityById(id: string): Promise<Activity> {
  const res = await api.get<Envelope<ApiActivity>>(`/api/activities/${id}`);
  return mapActivity(res.data);
}

export async function createActivity(payload: CreateActivityPayload): Promise<Activity> {
  const res = await api.post<Envelope<ApiActivity>>("/api/activities", {
    type: payload.type,
    subject: payload.subject,
    description: payload.description,
    result: payload.result,
    scheduled_at: payload.scheduled_at,
    completed_at: payload.completed_at,
    lead_id: payload.lead_id,
    deal_id: payload.deal_id,
    contact_id: payload.contact_id,
    assigned_to_id: payload.assigned_to_id,
    metadata: payload.metadata,
  });
  return mapActivity(res.data);
}

export async function updateActivity(id: string, payload: UpdateActivityPayload): Promise<Activity> {
  const res = await api.patch<Envelope<ApiActivity>>(`/api/activities/${id}`, {
    subject: payload.subject,
    description: payload.description,
    result: payload.result,
    scheduled_at: payload.scheduled_at,
    completed_at: payload.completed_at,
    assigned_to_id: payload.assigned_to_id,
  });
  return mapActivity(res.data);
}

export async function deleteActivity(id: string): Promise<void> {
  await api.delete(`/api/activities/${id}`);
}

export async function completeActivity(
  id: string,
  result: string,
  _userId?: string,
): Promise<Activity> {
  return updateActivity(id, { result: result as ActivityResult, completed_at: new Date().toISOString() });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function fetchComments(activityId: string): Promise<Comment[]> {
  const res = await api.get<Envelope<ApiComment[]>>(`/api/activities/${activityId}/comments`);
  return res.data.map(mapComment);
}

export async function addComment(
  activityId: string,
  text: string,
  _createdBy?: string,
): Promise<Comment> {
  const res = await api.post<Envelope<ApiComment>>(`/api/activities/${activityId}/comments`, { text });
  return mapComment(res.data);
}

export async function updateComment(id: string, _text: string): Promise<Comment> {
  // No PATCH /api/activities/:id/comments/:commentId endpoint yet
  throw new Error("updateComment: no API endpoint yet");
}

export async function deleteComment(_id: string): Promise<void> {
  // No DELETE endpoint yet — no-op
  console.warn("deleteComment: no API endpoint yet");
}
