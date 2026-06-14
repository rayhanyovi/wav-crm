import type { AuditLog, Prisma } from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError } from "../../lib/errors.js";
import type { Actor } from "../../middleware/context.js";
import { canViewAuditLogs } from "./auditLogs.authz.js";
import type { ListQuery } from "./auditLogs.schema.js";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listAuditLogs(actor: Actor, query: ListQuery): Promise<Paginated<AuditLog>> {
  if (!canViewAuditLogs(actor)) throw new ForbiddenError("Only MASTER can view audit logs");

  const where: Prisma.AuditLogWhereInput = {};
  if (query.entity_type) where.entityType = query.entity_type;
  if (query.entity_id) where.entityId = query.entity_id;
  if (query.user_id) where.userId = query.user_id;

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, total, page: query.page, pageSize: query.pageSize };
}
