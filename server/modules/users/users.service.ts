import { type CrmUser, type Prisma, Role } from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import type { Actor } from "../../middleware/context.js";
import { canListUsers, canManageUsers, canViewUser } from "./users.authz.js";
import type { ListQuery, UpdateUserInput } from "./users.schema.js";
import { writeAuditLog } from "./users.sideEffects.js";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listUsers(actor: Actor, query: ListQuery): Promise<Paginated<CrmUser>> {
  if (!canListUsers(actor)) throw new ForbiddenError("Not allowed to list users");

  const where: Prisma.CrmUserWhereInput = {};
  if (actor.role !== "MASTER") where.isActive = true;
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
    if (input.telemarketer_id !== undefined) data.telemarketerId = input.telemarketer_id ?? null;
    if (input.leads_access !== undefined) data.leadsAccess = input.leads_access;

    const next = await tx.crmUser.update({ where: { id }, data });
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: prev, next });
    return next;
  });
}

// ─── Onboarding / approval ──────────────────────────────────────────────────────

const PENDING_STATUSES = ["PENDING_APPROVAL", "PENDING_PROFILE"] as const;

/** MASTER-only: users awaiting approval or who haven't finished onboarding. */
export async function listPendingUsers(actor: Actor): Promise<CrmUser[]> {
  if (!canManageUsers(actor)) throw new ForbiddenError("Only MASTER can review pending users");
  return prisma.crmUser.findMany({
    where: { accountStatus: { in: [...PENDING_STATUSES] } },
    orderBy: { createdAt: "asc" },
  });
}

/** MASTER-only: assign a role, activate the account, and clear the requested role. */
export async function approveUser(actor: Actor, id: string, role: string): Promise<CrmUser> {
  if (!canManageUsers(actor)) throw new ForbiddenError("Only MASTER can approve users");
  return prisma.$transaction(async (tx) => {
    const prev = await tx.crmUser.findUnique({ where: { id } });
    if (!prev) throw new NotFoundError("User not found");
    const next = await tx.crmUser.update({
      where: { id },
      data: { role: role as Role, isActive: true, accountStatus: "ACTIVE", requestedRole: null },
    });
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: prev, next });
    return next;
  });
}

/** MASTER-only: mark an account rejected and deactivate it. */
export async function rejectUser(actor: Actor, id: string): Promise<CrmUser> {
  if (!canManageUsers(actor)) throw new ForbiddenError("Only MASTER can reject users");
  return prisma.$transaction(async (tx) => {
    const prev = await tx.crmUser.findUnique({ where: { id } });
    if (!prev) throw new NotFoundError("User not found");
    const next = await tx.crmUser.update({
      where: { id },
      data: { isActive: false, accountStatus: "REJECTED" },
    });
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: prev, next });
    return next;
  });
}

/**
 * The signed-in user finishes their own profile: records their name + requested
 * role and moves them into the approval queue. No role is granted here.
 */
export async function completeOnboarding(
  actor: Actor,
  name: string,
  requestedRole: string,
): Promise<CrmUser> {
  return prisma.crmUser.update({
    where: { id: actor.id },
    data: { name, requestedRole: requestedRole as Role, accountStatus: "PENDING_APPROVAL" },
  });
}

/**
 * Bootstrap the very first MASTER: only succeeds when no active MASTER exists yet
 * (otherwise it would be a privilege-escalation hole). The caller becomes MASTER.
 */
export async function activateSuperAdmin(actor: Actor): Promise<CrmUser> {
  return prisma.$transaction(async (tx) => {
    const existingMaster = await tx.crmUser.findFirst({
      where: { role: "MASTER", isActive: true },
    });
    if (existingMaster) {
      throw new ForbiddenError("A master account already exists");
    }
    return tx.crmUser.update({
      where: { id: actor.id },
      data: { role: "MASTER", isActive: true, accountStatus: "ACTIVE", requestedRole: null },
    });
  });
}
