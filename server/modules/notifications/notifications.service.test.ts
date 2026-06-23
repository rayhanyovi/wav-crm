import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

const db = vi.hoisted(() => ({
  notification: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    createMany: vi.fn(),
  },
  // listNotifications first sweeps due callbacks → reads/updates leads in a tx.
  lead: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const { listNotifications, markRead, markAllRead } = await import("./notifications.service.js");

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: "u1",
    authUserId: "auth-1",
    email: "a@b.c",
    role: "ADVISER",
    isActive: true,
    creditBalance: 0,
    telemarketerAccess: false,
    telemarketerId: null,
    leadsAccess: true,
    delegatedAdviserIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no appointment/callback reminders due, so sweeps are no-ops.
  db.lead.findMany.mockResolvedValue([]);
});

describe("listNotifications", () => {
  it("only returns own notifications (recipientId filter)", async () => {
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(0);

    await listNotifications(actor({ id: "u1" }), { page: 1, pageSize: 25 } as never);

    const where = db.notification.findMany.mock.calls[0]![0].where;
    expect(where.recipientId).toBe("u1");
    expect(where.type).toEqual({ in: ["APPOINTMENT_TODAY", "CALLBACK_TODAY", "CALLBACK_DUE"] });
  });

  it("filters unread_only when requested", async () => {
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(0);

    await listNotifications(actor(), { page: 1, pageSize: 25, unread_only: true } as never);

    const where = db.notification.findMany.mock.calls[0]![0].where;
    expect(where.isRead).toBe(false);
  });

  it("sweeps due callbacks: emits CALLBACK_DUE and marks them notified", async () => {
    db.lead.findMany
      .mockResolvedValueOnce([
        { id: "lead-1", firstName: "Jane", lastName: "Doe", callbackNote: "wants 2pm" },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(0);

    await listNotifications(actor({ id: "u1" }), { page: 1, pageSize: 25 } as never);

    // Only this actor's due, un-notified callbacks are swept.
    const sweepWhere = db.lead.findMany.mock.calls[0]![0].where;
    expect(sweepWhere).toMatchObject({ callbackAssignedTo: "u1", callbackNotified: false });

    expect(db.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ type: "CALLBACK_DUE", recipientId: "u1", entityId: "lead-1" }),
        ]),
      }),
    );
    expect(db.lead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["lead-1"] } }, data: { callbackNotified: true } }),
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("sweeps today's appointments into APPOINTMENT_TODAY reminders", async () => {
    db.lead.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "lead-2", firstName: "Ada", lastName: "Lovelace", appointmentTime: "14:00" },
      ])
      .mockResolvedValueOnce([]);
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(0);

    await listNotifications(actor({ id: "adv-1" }), { page: 1, pageSize: 25 } as never);

    const appointmentWhere = db.lead.findMany.mock.calls[1]![0].where;
    expect(appointmentWhere).toMatchObject({
      status: "APPOINTMENT",
      appointmentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      OR: [
        { assignedToId: "adv-1" },
        { deals: { some: { assignedToId: "adv-1", deletedAt: null } } },
      ],
    });
    expect(db.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ type: "APPOINTMENT_TODAY", recipientId: "adv-1", entityId: "lead-2" }),
        ]),
      }),
    );
  });

  it("sweeps today's callbacks into CALLBACK_TODAY without marking the callback notified", async () => {
    db.lead.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "lead-3",
          firstName: "Grace",
          lastName: "Hopper",
          callbackAt: new Date(),
          callbackNote: "after lunch",
        },
      ]);
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(0);

    await listNotifications(actor({ id: "tm-1" }), { page: 1, pageSize: 25 } as never);

    const callbackWhere = db.lead.findMany.mock.calls[2]![0].where;
    expect(callbackWhere).toMatchObject({ callbackAssignedTo: "tm-1", callbackNotified: false });
    expect(db.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ type: "CALLBACK_TODAY", recipientId: "tm-1", entityId: "lead-3" }),
        ]),
      }),
    );
    expect(db.lead.updateMany).not.toHaveBeenCalled();
  });
});

describe("markRead", () => {
  it("throws NOT_FOUND when notification is missing", async () => {
    db.notification.findUnique.mockResolvedValue(null);
    await expect(markRead(actor(), "n1")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN when not own notification", async () => {
    db.notification.findUnique.mockResolvedValue({ id: "n1", recipientId: "other" });
    await expect(markRead(actor({ id: "u1" }), "n1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sets isRead=true and readAt", async () => {
    db.notification.findUnique.mockResolvedValue({ id: "n1", recipientId: "u1" });
    db.notification.update.mockResolvedValue({ id: "n1", isRead: true });

    await markRead(actor({ id: "u1" }), "n1");

    const data = db.notification.update.mock.calls[0]![0].data;
    expect(data.isRead).toBe(true);
    expect(data.readAt).toBeInstanceOf(Date);
  });
});

describe("markAllRead", () => {
  it("bulk-updates only actor's unread notifications", async () => {
    db.notification.updateMany.mockResolvedValue({ count: 5 });

    const result = await markAllRead(actor({ id: "u1" }));

    expect(result.count).toBe(5);
    const where = db.notification.updateMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      recipientId: "u1",
      isRead: false,
      type: { in: ["APPOINTMENT_TODAY", "CALLBACK_TODAY", "CALLBACK_DUE"] },
    });
  });
});
