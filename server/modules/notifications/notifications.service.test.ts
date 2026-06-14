import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

const db = vi.hoisted(() => ({
  notification: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
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
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("listNotifications", () => {
  it("only returns own notifications (recipientId filter)", async () => {
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(0);

    await listNotifications(actor({ id: "u1" }), { page: 1, pageSize: 25 } as never);

    const where = db.notification.findMany.mock.calls[0]![0].where;
    expect(where.recipientId).toBe("u1");
  });

  it("filters unread_only when requested", async () => {
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValue(0);

    await listNotifications(actor(), { page: 1, pageSize: 25, unread_only: true } as never);

    const where = db.notification.findMany.mock.calls[0]![0].where;
    expect(where.isRead).toBe(false);
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
    expect(where).toMatchObject({ recipientId: "u1", isRead: false });
  });
});
