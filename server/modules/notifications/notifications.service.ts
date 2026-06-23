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

const REMINDER_TIME_ZONE = "Asia/Jakarta";
const REMINDER_NOTIFICATION_TYPES = ["APPOINTMENT_TODAY", "CALLBACK_TODAY", "CALLBACK_DUE"] as const;

function dateKeyInReminderTimeZone(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REMINDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim() || "a lead";
}

async function existingReminderEntityIds(
  actor: Actor,
  type: (typeof REMINDER_NOTIFICATION_TYPES)[number],
  entityIds: string[],
  todayKey: string,
): Promise<Set<string>> {
  if (entityIds.length === 0) return new Set();

  const existing = await prisma.notification.findMany({
    where: {
      recipientId: actor.id,
      type,
      entityType: "lead",
      entityId: { in: entityIds },
    },
    select: { entityId: true, createdAt: true },
  });

  return new Set(
    existing
      .filter((notification) => dateKeyInReminderTimeZone(notification.createdAt) === todayKey)
      .map((notification) => notification.entityId),
  );
}

async function sweepTodaysAppointments(actor: Actor, todayKey: string): Promise<void> {
  const appointments = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      status: "APPOINTMENT",
      appointmentDate: todayKey,
      OR: [
        { assignedToId: actor.id },
        { deals: { some: { assignedToId: actor.id, deletedAt: null } } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, appointmentTime: true },
  });
  if (appointments.length === 0) return;

  const alreadyNotified = await existingReminderEntityIds(
    actor,
    "APPOINTMENT_TODAY",
    appointments.map((lead) => lead.id),
    todayKey,
  );
  const pending = appointments.filter((lead) => !alreadyNotified.has(lead.id));
  if (pending.length === 0) return;

  await prisma.notification.createMany({
    data: pending.map((lead) => ({
      recipientId: actor.id,
      type: "APPOINTMENT_TODAY",
      title: "Appointment today",
      message: `${fullName(lead.firstName, lead.lastName)} has an appointment today${lead.appointmentTime ? ` at ${lead.appointmentTime}` : ""}.`,
      entityType: "lead",
      entityId: lead.id,
    })),
  });
}

async function sweepTodaysCallbacks(actor: Actor, todayKey: string): Promise<void> {
  const callbacks = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      convertedAt: null,
      callbackNotified: false,
      callbackAt: { not: null },
      callbackAssignedTo: actor.id,
    },
    select: { id: true, firstName: true, lastName: true, callbackAt: true, callbackNote: true },
  });
  const today = callbacks.filter(
    (lead) => lead.callbackAt && dateKeyInReminderTimeZone(lead.callbackAt) === todayKey,
  );
  if (today.length === 0) return;

  const alreadyNotified = await existingReminderEntityIds(
    actor,
    "CALLBACK_TODAY",
    today.map((lead) => lead.id),
    todayKey,
  );
  const pending = today.filter((lead) => !alreadyNotified.has(lead.id));
  if (pending.length === 0) return;

  await prisma.notification.createMany({
    data: pending.map((lead) => ({
      recipientId: actor.id,
      type: "CALLBACK_TODAY",
      title: "Callback today",
      message: `${fullName(lead.firstName, lead.lastName)} has a scheduled callback today${lead.callbackNote ? ` - ${lead.callbackNote}` : ""}.`,
      entityType: "lead",
      entityId: lead.id,
    })),
  });
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
  const todayKey = dateKeyInReminderTimeZone(new Date());
  await sweepDueCallbacks(actor);
  await sweepTodaysAppointments(actor, todayKey);
  await sweepTodaysCallbacks(actor, todayKey);

  const where: Prisma.NotificationWhereInput = {
    recipientId: actor.id,
    type: { in: [...REMINDER_NOTIFICATION_TYPES] },
  };
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
    where: { recipientId: actor.id, isRead: false, type: { in: [...REMINDER_NOTIFICATION_TYPES] } },
    data: { isRead: true, readAt: new Date() },
  });
  return { count: result.count };
}
