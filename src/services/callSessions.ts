import { nanoid } from "nanoid";
import { supabase } from "@/lib/supabase";
import type { CallSession } from "@/data/types";

export interface CallSessionFilters {
  userId?: string;
}

export type CreateCallSessionPayload = Omit<CallSession, "id">;

interface CallSessionRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  total_duration_seconds: number;
  calls_made: number;
  pickups: number;
  lead_ids: string[] | null;
}

const CALL_SESSION_SELECT =
  "id,user_id,started_at,ended_at,total_duration_seconds,calls_made,pickups,lead_ids";

function mapCallSessionRow(row: CallSessionRow): CallSession {
  return {
    id: row.id,
    user_id: row.user_id,
    started_at: row.started_at,
    ended_at: row.ended_at ?? undefined,
    total_duration_seconds: row.total_duration_seconds,
    calls_made: row.calls_made,
    pickups: row.pickups,
    lead_ids: row.lead_ids ?? [],
  };
}

export async function fetchCallSessions(filters?: CallSessionFilters): Promise<CallSession[]> {
  let query = supabase
    .from("call_sessions")
    .select(CALL_SESSION_SELECT)
    .order("started_at", { ascending: false });

  if (filters?.userId) query = query.eq("user_id", filters.userId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as CallSessionRow[]).map(mapCallSessionRow);
}

export async function createCallSession(payload: CreateCallSessionPayload): Promise<CallSession> {
  const { data, error } = await supabase
    .from("call_sessions")
    .insert({
      id: `cs-${nanoid(8)}`,
      user_id: payload.user_id,
      started_at: payload.started_at,
      ended_at: payload.ended_at ?? null,
      total_duration_seconds: payload.total_duration_seconds,
      calls_made: payload.calls_made,
      pickups: payload.pickups,
      lead_ids: payload.lead_ids,
    })
    .select(CALL_SESSION_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapCallSessionRow(data as CallSessionRow);
}
