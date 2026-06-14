import { api, type Page } from "@/lib/api";
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

// ─── API response shape (Prisma camelCase) ────────────────────────────────────

interface ApiAuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function mapAuditLog(r: ApiAuditLog): AuditLog {
  return {
    id: r.id,
    user_id: r.userId,
    action: r.action as AuditLog["action"],
    entity_type: r.entityType,
    entity_id: r.entityId,
    metadata: r.metadata ?? undefined,
    created_at: r.createdAt,
  };
}

// ─── Service function ─────────────────────────────────────────────────────────

export async function fetchAuditLogs(filters: AuditLogFilters): Promise<AuditLogPage> {
  const params: Record<string, string | number | undefined> = {
    page: filters.page,
    pageSize: filters.pageSize,
  };

  if (filters.userId) params.user_id = filters.userId;
  if (filters.entityType && filters.entityType !== "ALL") params.entity_type = filters.entityType;
  // Note: backend doesn't support action/search filters yet — kept for interface compat

  const res = await api.get<Page<ApiAuditLog>>("/api/audit-logs", params);
  return {
    items: res.data.map(mapAuditLog),
    total: res.total,
  };
}
