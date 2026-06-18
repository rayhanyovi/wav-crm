import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "../../middleware/context.js";

const db = vi.hoisted(() => ({
  callSession: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: db }));

const { listCallSessions, saveCallSession } = await import("./callSessions.service.js");
const { canCreateCallSession, canListCallSessions } = await import("./callSessions.authz.js");

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: "u1",
    authUserId: "auth-1",
    email: "a@b.c",
    role: "TELEMARKETER",
    isActive: true,
    creditBalance: 0,
    telemarketerAccess: false,
    telemarketerId: null,
    leadsAccess: true,
    delegatedAdviserIds: [],
    ...overrides,
  };
}

const baseInput = {
  id: "s1",
  started_at: "2026-07-01T10:00:00.000Z",
  total_duration_seconds: 0,
  calls_made: 0,
  pickups: 0,
  lead_ids: [] as string[],
};

beforeEach(() => vi.clearAllMocks());

describe("callSessions.authz", () => {
  it("allows MASTER, TELEMARKETER and ADVISER", () => {
    for (const role of ["MASTER", "TELEMARKETER", "ADVISER"] as const) {
      expect(canCreateCallSession(actor({ role }))).toBe(true);
      expect(canListCallSessions(actor({ role }))).toBe(true);
    }
  });

  it("denies an unrecognised role", () => {
    expect(canCreateCallSession(actor({ role: "GUEST" as never }))).toBe(false);
    expect(canListCallSessions(actor({ role: "GUEST" as never }))).toBe(false);
  });
});

describe("listCallSessions", () => {
  it("MASTER sees all sessions (no user filter)", async () => {
    db.callSession.findMany.mockResolvedValue([]);
    db.callSession.count.mockResolvedValue(0);

    await listCallSessions(actor({ role: "MASTER" }), { page: 1, pageSize: 25 } as never);
    expect(db.callSession.findMany.mock.calls[0]![0].where).toEqual({});
  });

  it("non-MASTER is scoped to their own sessions", async () => {
    db.callSession.findMany.mockResolvedValue([{ id: "s1" }]);
    db.callSession.count.mockResolvedValue(1);

    const res = await listCallSessions(actor({ id: "u1" }), { page: 1, pageSize: 25 } as never);
    expect(db.callSession.findMany.mock.calls[0]![0].where).toEqual({ userId: "u1" });
    expect(res.total).toBe(1);
  });

  it("forbids an unrecognised role", async () => {
    await expect(
      listCallSessions(actor({ role: "GUEST" as never }), { page: 1, pageSize: 25 } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("saveCallSession", () => {
  it("creates a session stamped with the actor and parsed dates", async () => {
    db.callSession.findUnique.mockResolvedValue(null);
    db.callSession.create.mockResolvedValue({ id: "s1" });

    await saveCallSession(actor({ id: "u1" }), {
      ...baseInput,
      ended_at: "2026-07-01T10:30:00.000Z",
      total_duration_seconds: 1800,
      calls_made: 10,
      pickups: 4,
      lead_ids: ["l1", "l2"],
    } as never);

    const data = db.callSession.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      id: "s1", userId: "u1", totalDurationSeconds: 1800, callsMade: 10, pickups: 4, leadIds: ["l1", "l2"],
    });
    expect(data.startedAt).toBeInstanceOf(Date);
    expect(data.endedAt).toBeInstanceOf(Date);
  });

  it("omits endedAt when not provided", async () => {
    db.callSession.findUnique.mockResolvedValue(null);
    db.callSession.create.mockResolvedValue({ id: "s2" });

    await saveCallSession(actor(), { ...baseInput, id: "s2" } as never);
    expect(db.callSession.create.mock.calls[0]![0].data.endedAt).toBeUndefined();
  });

  it("throws CONFLICT when the session id already exists (idempotency)", async () => {
    db.callSession.findUnique.mockResolvedValue({ id: "s1" });
    await expect(saveCallSession(actor(), baseInput as never)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("forbids an unrecognised role", async () => {
    await expect(
      saveCallSession(actor({ role: "GUEST" as never }), baseInput as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
