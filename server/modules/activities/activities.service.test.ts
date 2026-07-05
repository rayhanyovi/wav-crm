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
  lead: { update: vi.fn() },
  comment: { findMany: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  softDeleteActivity,
  getComments,
  addComment,
} = await import("./activities.service.js");

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

  it("persists metadata for call details", async () => {
    const created = activity();
    db.activity.create.mockResolvedValue(created);
    db.auditLog.create.mockResolvedValue({});

    await createActivity(actor({ id: "u1" }), {
      type: "CALL",
      subject: "Test",
      metadata: { duration_seconds: 45 },
    } as never);

    expect(db.activity.create.mock.calls[0]![0].data.metadata).toEqual({ duration_seconds: 45 });
  });

  it("tracks call attempts and clears stale callbacks when logging a call", async () => {
    const created = activity();
    db.activity.create.mockResolvedValue(created);
    db.lead.update.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});

    await createActivity(actor({ id: "u1" }), {
      type: "CALL",
      subject: "Test",
      lead_id: "lead-1",
      completed_at: "2026-07-01T10:30:00.000Z",
    } as never);

    expect(db.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: {
        lastContactedAt: new Date("2026-07-01T10:30:00.000Z"),
        callAttemptCount: { increment: 1 },
        lastCallAttemptAt: new Date("2026-07-01T10:30:00.000Z"),
        callbackAt: null,
        callbackAssignedTo: null,
        callbackNote: null,
        callbackNotified: false,
      },
    });
  });

  it("increments the no-answer bucket for no-answer calls", async () => {
    const created = activity();
    db.activity.create.mockResolvedValue(created);
    db.lead.update.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});

    await createActivity(actor({ id: "u1" }), {
      type: "CALL",
      subject: "Test",
      lead_id: "lead-1",
      result: "NO_ANSWER",
      completed_at: "2026-07-01T10:30:00.000Z",
    } as never);

    const data = db.lead.update.mock.calls.at(-1)![0].data;
    expect(data.noAnswerCount).toEqual({ increment: 1 });
    expect(data.lastNoAnswerAt).toEqual(new Date("2026-07-01T10:30:00.000Z"));
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

  it("throws NOT_FOUND when commenting on a missing activity", async () => {
    db.activity.findFirst.mockResolvedValue(null);
    await expect(addComment(actor(), "x", { text: "hi" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("updateActivity", () => {
  it("throws NOT_FOUND when missing", async () => {
    db.activity.findFirst.mockResolvedValue(null);
    await expect(updateActivity(actor(), "x", { subject: "X" } as never)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("forbids a non-creator non-MASTER", async () => {
    db.activity.findFirst.mockResolvedValue(activity({ createdBy: "other" }));
    await expect(
      updateActivity(actor({ id: "u1" }), "act-1", { subject: "X" } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("patches fields and can clear/ set scheduled & completed dates", async () => {
    db.activity.findFirst.mockResolvedValue(activity({ createdBy: "u1" }));
    db.activity.update.mockResolvedValue(activity());
    db.auditLog.create.mockResolvedValue({});

    await updateActivity(actor({ id: "u1" }), "act-1", {
      subject: "S", description: "D", result: "COMPLETED",
      scheduled_at: "2026-07-01T10:00:00.000Z", completed_at: null, assigned_to_id: "u2",
    } as never);

    const data = db.activity.update.mock.calls[0]![0].data;
    expect(data.subject).toBe("S");
    expect(data.scheduledAt).toBeInstanceOf(Date);
    expect(data.completedAt).toBeNull();
    expect(data.assignedToId).toBe("u2");
  });
});

describe("softDeleteActivity", () => {
  it("forbids non-MASTER", async () => {
    await expect(softDeleteActivity(actor({ role: "ADVISER" }), "act-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sets deletedAt for MASTER", async () => {
    db.activity.findFirst.mockResolvedValue(activity());
    db.activity.update.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});

    await softDeleteActivity(actor({ role: "MASTER" }), "act-1");
    expect(db.activity.update.mock.calls[0]![0].data.deletedAt).toBeInstanceOf(Date);
  });

  it("throws NOT_FOUND when missing", async () => {
    db.activity.findFirst.mockResolvedValue(null);
    await expect(softDeleteActivity(actor({ role: "MASTER" }), "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("getComments", () => {
  it("returns comments for a viewable activity", async () => {
    db.activity.findFirst.mockResolvedValue(activity({ createdBy: "u1" }));
    db.comment.findMany.mockResolvedValue([{ id: "c1" }]);

    const res = await getComments(actor({ id: "u1" }), "act-1");
    expect(res).toHaveLength(1);
    expect(db.comment.findMany.mock.calls[0]![0]).toMatchObject({ where: { activityId: "act-1" } });
  });

  it("throws NOT_FOUND when the activity is missing", async () => {
    db.activity.findFirst.mockResolvedValue(null);
    await expect(getComments(actor(), "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
