import type { Notification, Prisma } from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import type { Actor } from "../../middleware/context.js";
import type { ListQuery } from "./notifications.schema.js";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Lazily emit "callback due" notifications. Called when a user polls their
 * notifications, so no cron/scheduler is needed: any of the actor's scheduled
 * callbacks whose time has arrived (and that haven't been notified yet) produce
 * one notification and are marked notified. Idempotent.
 */
async function sweepDueCallbacks(actor: Actor): Promise<void> {
  const now = new Date();
  const due = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      convertedAt: null,
      callbackNotified: false,
      callbackAt: { lte: now },
      callbackAssignedTo: actor.id,
    },
    select: { id: true, firstName: true, lastName: true, callbackNote: true },
  });
  if (due.length === 0) return;

  await prisma.$transaction([
    prisma.notification.createMany({
      data: due.map((l) => ({
        recipientId: actor.id,
        type: "CALLBACK_DUE",
        title: "Callback due now",
        message: `Time to call ${`${l.firstName} ${l.lastName}`.trim() || "a lead"} back${l.callbackNote ? ` — ${l.callbackNote}` : ""}.`,
        entityType: "lead",
        entityId: l.id,
      })),
    }),
    prisma.lead.updateMany({
      where: { id: { in: due.map((l) => l.id) } },
      data: { callbackNotified: true },
    }),
  ]);
}

export async function listNotifications(
  actor: Actor,
  query: ListQuery,
): Promise<Paginated<Notification>> {
  await sweepDueCallbacks(actor);

  const where: Prisma.NotificationWhereInput = { recipientId: actor.id };
  if (query.unread_only) where.isRead = false;

  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function markRead(actor: Actor, id: string): Promise<Notification> {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw new NotFoundError("Notification not found");
  if (notification.recipientId !== actor.id) throw new ForbiddenError("Not your notification");

  return prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllRead(actor: Actor): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: { recipientId: actor.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { count: result.count };
}
