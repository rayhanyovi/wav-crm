import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

const db = vi.hoisted(() => ({
  activity: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  comment: { findMany: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const { listActivities, getActivity, createActivity, addComment } = await import(
  "./activities.service.js"
);

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

function activity(overrides: Record<string, unknown> = {}) {
  return { id: "act-1", createdBy: "u1", assignedToId: null, deletedAt: null, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => unknown) => cb(db));
});

describe("listActivities", () => {
  it("non-MASTER only sees their own activities", async () => {
    db.activity.findMany.mockResolvedValue([]);
    db.activity.count.mockResolvedValue(0);

    await listActivities(actor({ id: "u1" }), { page: 1, pageSize: 25 } as never);

    const where = db.activity.findMany.mock.calls[0]![0].where;
    expect(where.OR).toEqual([{ createdBy: "u1" }, { assignedToId: "u1" }]);
  });

  it("MASTER has no OR filter", async () => {
    db.activity.findMany.mockResolvedValue([]);
    db.activity.count.mockResolvedValue(0);

    await listActivities(actor({ role: "MASTER" }), { page: 1, pageSize: 25 } as never);

    const where = db.activity.findMany.mock.calls[0]![0].where;
    expect(where.OR).toBeUndefined();
  });

  it("calendar filter adds scheduledAt != null", async () => {
    db.activity.findMany.mockResolvedValue([]);
    db.activity.count.mockResolvedValue(0);

    await listActivities(actor({ role: "MASTER" }), { page: 1, pageSize: 25, calendar: true } as never);

    const where = db.activity.findMany.mock.calls[0]![0].where;
    expect(where.scheduledAt).toEqual({ not: null });
  });
});

describe("getActivity", () => {
  it("throws NOT_FOUND when missing", async () => {
    db.activity.findFirst.mockResolvedValue(null);
    await expect(getActivity(actor(), "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN when actor has no access", async () => {
    db.activity.findFirst.mockResolvedValue(activity({ createdBy: "other", assignedToId: "other2" }));
    await expect(getActivity(actor({ id: "u1" }), "act-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("createActivity", () => {
  it("sets createdBy from actor", async () => {
    const created = activity();
    db.activity.create.mockResolvedValue(created);
    db.auditLog.create.mockResolvedValue({});

    await createActivity(actor({ id: "u1" }), { type: "CALL", subject: "Test" } as never);
    expect(db.activity.create.mock.calls[0]![0].data.createdBy).toBe("u1");
  });
});

describe("addComment", () => {
  it("throws FORBIDDEN when actor cannot view the activity", async () => {
    db.activity.findFirst.mockResolvedValue(activity({ createdBy: "other", assignedToId: null }));
    await expect(
      addComment(actor({ id: "u1" }), "act-1", { text: "hello" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates comment with actor as createdBy", async () => {
    db.activity.findFirst.mockResolvedValue(activity({ createdBy: "u1" }));
    db.comment.create.mockResolvedValue({ id: "cmt-1", text: "hi" });

    await addComment(actor({ id: "u1" }), "act-1", { text: "hi" });
    expect(db.comment.create.mock.calls[0]![0].data.createdBy).toBe("u1");
  });
});
