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

export async function listNotifications(
  actor: Actor,
  query: ListQuery,
): Promise<Paginated<Notification>> {
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
