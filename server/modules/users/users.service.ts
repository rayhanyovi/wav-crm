import type { CrmUser, Prisma } from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import type { Actor } from "../../middleware/context.js";
import { canManageUsers, canViewUser } from "./users.authz.js";
import type { ListQuery, UpdateUserInput } from "./users.schema.js";
import { writeAuditLog } from "./users.sideEffects.js";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listUsers(actor: Actor, query: ListQuery): Promise<Paginated<CrmUser>> {
  if (!canManageUsers(actor)) throw new ForbiddenError("Only MASTER can list users");

  const where: Prisma.CrmUserWhereInput = {};
  if (query.role) where.role = query.role;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.crmUser.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.crmUser.count({ where }),
  ]);

  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function getUser(actor: Actor, id: string): Promise<CrmUser> {
  if (!canViewUser(actor, id)) throw new ForbiddenError("Not allowed to view this user");
  const user = await prisma.crmUser.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export async function updateUser(
  actor: Actor,
  id: string,
  input: UpdateUserInput,
): Promise<CrmUser> {
  if (!canManageUsers(actor)) throw new ForbiddenError("Only MASTER can update users");

  return prisma.$transaction(async (tx) => {
    const prev = await tx.crmUser.findUnique({ where: { id } });
    if (!prev) throw new NotFoundError("User not found");

    const data: Prisma.CrmUserUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.role !== undefined) data.role = input.role;
    if (input.is_active !== undefined) data.isActive = input.is_active;
    if (input.credit_balance !== undefined) data.creditBalance = input.credit_balance;
    if (input.telemarketer_access !== undefined) data.telemarketerAccess = input.telemarketer_access;
    if (input.telemarketer_id !== undefined) data.telemarketerId = input.telemarketer_id ?? undefined;
    if (input.leads_access !== undefined) data.leadsAccess = input.leads_access;

    const next = await tx.crmUser.update({ where: { id }, data });
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: prev, next });
    return next;
  });
}
