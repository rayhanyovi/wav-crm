import { api, type Envelope, type Page } from "@/lib/api";
import type { CallSession } from "@/data/types";

export interface CallSessionFilters {
  userId?: string;
}

export type CreateCallSessionPayload = Omit<CallSession, "id">;

// ─── API response shape ───────────────────────────────────────────────────────

interface ApiCallSession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  totalDurationSeconds: number;
  callsMade: number;
  pickups: number;
  leadIds: string[];
}

function mapCallSession(r: ApiCallSession): CallSession {
  return {
    id: r.id,
    user_id: r.userId,
    started_at: r.startedAt,
    ended_at: r.endedAt ?? undefined,
    total_duration_seconds: r.totalDurationSeconds,
    calls_made: r.callsMade,
    pickups: r.pickups,
    lead_ids: r.leadIds ?? [],
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function fetchCallSessions(filters?: CallSessionFilters): Promise<CallSession[]> {
  const res = await api.get<Page<ApiCallSession>>("/api/call-sessions", {
    page: 1,
    pageSize: 500,
  });
  const sessions = res.data.map(mapCallSession);
  if (!filters?.userId) return sessions;
  return sessions.filter((session) => session.user_id === filters.userId);
}

export async function createCallSession(payload: CreateCallSessionPayload): Promise<CallSession> {
  const id = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await api.post<Envelope<ApiCallSession>>("/api/call-sessions", {
    id,
    started_at: payload.started_at,
    ended_at: payload.ended_at,
    total_duration_seconds: payload.total_duration_seconds,
    calls_made: payload.calls_made,
    pickups: payload.pickups,
    lead_ids: payload.lead_ids ?? [],
  });
  return mapCallSession(res.data);
}
