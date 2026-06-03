import { supabase } from "@/lib/supabase";
import type { AuditLog } from "@/data/types";

export interface AuditLogFilters {
  page: number;
  pageSize: number;
  userId?: string;
  action?: string | "ALL";
  entityType?: string | "ALL";
  search?: string;
}

export interface AuditLogPage {
  items: AuditLog[];
  total: number;
}

interface AuditLogRow {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function mapAuditLogRow(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    user_id: row.user_id,
    action: row.action as AuditLog["action"],
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    metadata: row.metadata ?? undefined,
    created_at: row.created_at,
  };
}

export async function fetchAuditLogs(filters: AuditLogFilters): Promise<AuditLogPage> {
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  let query = supabase
    .from("audit_logs")
    .select("id,user_id,action,entity_type,entity_id,metadata,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.action && filters.action !== "ALL") query = query.eq("action", filters.action);
  if (filters.entityType && filters.entityType !== "ALL") query = query.eq("entity_type", filters.entityType);
  if (filters.search?.trim()) {
    const term = filters.search.trim();
    query = query.or(
      `entity_type.ilike.%${term}%,action.ilike.%${term}%,entity_id.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    items: ((data ?? []) as AuditLogRow[]).map(mapAuditLogRow),
    total: count ?? 0,
  };
}
