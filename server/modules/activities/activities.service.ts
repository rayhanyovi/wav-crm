import { randomUUID } from "node:crypto";
import type { Activity, Comment, Prisma } from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import type { Actor } from "../../middleware/context.js";
import {
  canCreateActivity,
  canDeleteActivity,
  canListActivities,
  canMutateActivity,
  canViewActivity,
} from "./activities.authz.js";
import type {
  AddCommentInput,
  CreateActivityInput,
  ListQuery,
  UpdateActivityInput,
} from "./activities.schema.js";
import { writeAuditLog } from "./activities.sideEffects.js";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

function callAttemptedAt(input: CreateActivityInput, completedAt: Date | undefined): Date {
  if (completedAt) return completedAt;
  if (input.scheduled_at) return new Date(input.scheduled_at);
  return new Date();
}

export async function listActivities(actor: Actor, query: ListQuery): Promise<Paginated<Activity>> {
  if (!canListActivities(actor)) throw new ForbiddenError("Not allowed to view activities");

  const where: Prisma.ActivityWhereInput = { deletedAt: null };

  // Role-based scope: non-MASTER users only see what they created or are assigned to
  if (actor.role !== "MASTER") {
    where.OR = [{ createdBy: actor.id }, { assignedToId: actor.id }];
  }

  if (query.lead_id) where.leadId = query.lead_id;
  if (query.deal_id) where.dealId = query.deal_id;
  if (query.contact_id) where.contactId = query.contact_id;
  if (query.type) where.type = query.type;
  if (query.calendar) where.scheduledAt = { not: null };

  const [data, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.activity.count({ where }),
  ]);

  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function getActivity(actor: Actor, id: string): Promise<Activity> {
  const activity = await prisma.activity.findFirst({ where: { id, deletedAt: null } });
  if (!activity) throw new NotFoundError("Activity not found");
  if (!canViewActivity(actor, activity)) throw new ForbiddenError("Not allowed to view this activity");
  return activity;
}

export async function createActivity(actor: Actor, input: CreateActivityInput): Promise<Activity> {
  if (!canCreateActivity(actor)) throw new ForbiddenError("Not allowed to create activities");

  return prisma.$transaction(async (tx) => {
    const completedAt = input.completed_at ? new Date(input.completed_at) : undefined;
    const activity = await tx.activity.create({
      data: {
        id: randomUUID(),
        type: input.type,
        subject: input.subject,
        description: input.description,
        result: input.result,
        scheduledAt: input.scheduled_at ? new Date(input.scheduled_at) : undefined,
        completedAt,
        leadId: input.lead_id,
        dealId: input.deal_id,
        contactId: input.contact_id,
        assignedToId: input.assigned_to_id,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        createdBy: actor.id,
      },
    });

    if (input.type === "CALL" && input.lead_id) {
      const attemptedAt = callAttemptedAt(input, completedAt);
      const leadData: Prisma.LeadUpdateInput = {
        lastContactedAt: attemptedAt,
        callAttemptCount: { increment: 1 },
        lastCallAttemptAt: attemptedAt,
        callbackAt: null,
        callbackAssignedTo: null,
        callbackNote: null,
        callbackNotified: false,
      };
      if (input.result === "NO_ANSWER") {
        leadData.noAnswerCount = { increment: 1 };
        leadData.lastNoAnswerAt = attemptedAt;
      }
      await tx.lead.update({
        where: { id: input.lead_id },
        data: leadData,
      });
    }

    await writeAuditLog(tx, { userId: actor.id, action: "CREATE", entityId: activity.id, old: null, next: activity });
    return activity;
  });
}

export async function updateActivity(
  actor: Actor,
  id: string,
  input: UpdateActivityInput,
): Promise<Activity> {
  return prisma.$transaction(async (tx) => {
    const prev = await tx.activity.findFirst({ where: { id, deletedAt: null } });
    if (!prev) throw new NotFoundError("Activity not found");
    if (!canMutateActivity(actor, prev)) throw new ForbiddenError("Not allowed to update this activity");

    const data: Prisma.ActivityUpdateInput = {};
    if (input.subject !== undefined) data.subject = input.subject;
    if (input.description !== undefined) data.description = input.description ?? undefined;
    if (input.result !== undefined) data.result = input.result ?? undefined;
    if (input.scheduled_at !== undefined) {
      data.scheduledAt = input.scheduled_at ? new Date(input.scheduled_at) : null;
    }
    if (input.completed_at !== undefined) {
      data.completedAt = input.completed_at ? new Date(input.completed_at) : null;
    }
    if (input.assigned_to_id !== undefined) data.assignedToId = input.assigned_to_id ?? undefined;

    const next = await tx.activity.update({ where: { id }, data });
    await writeAuditLog(tx, { userId: actor.id, action: "UPDATE", entityId: id, old: prev, next });
    return next;
  });
}

export async function softDeleteActivity(actor: Actor, id: string): Promise<void> {
  if (!canDeleteActivity(actor)) throw new ForbiddenError("Only MASTER can delete activities");

  await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.findFirst({ where: { id, deletedAt: null } });
    if (!activity) throw new NotFoundError("Activity not found");

    await tx.activity.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(tx, { userId: actor.id, action: "DELETE", entityId: id, old: activity, next: null });
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getComments(actor: Actor, activityId: string): Promise<Comment[]> {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, deletedAt: null } });
  if (!activity) throw new NotFoundError("Activity not found");
  if (!canViewActivity(actor, activity)) throw new ForbiddenError("Not allowed to view this activity");

  return prisma.comment.findMany({ where: { activityId }, orderBy: { createdAt: "asc" } });
}

export async function addComment(
  actor: Actor,
  activityId: string,
  input: AddCommentInput,
): Promise<Comment> {
  const activity = await prisma.activity.findFirst({ where: { id: activityId, deletedAt: null } });
  if (!activity) throw new NotFoundError("Activity not found");
  if (!canViewActivity(actor, activity)) throw new ForbiddenError("Not allowed to comment on this activity");

  return prisma.comment.create({
    data: { activityId, text: input.text, createdBy: actor.id },
  });
}
