import { describe, expect, it } from "vitest";
import {
  getLastContactedDate,
  getLeadActivities,
  getDealActivities,
  getContactActivities,
  getStaleDeals,
  getDaysSince,
  getTodayCallStats,
} from "@/lib/selectors";
import type { Activity, CallSession, Deal } from "@/data/types";

function act(o: Partial<Activity>): Activity {
  return { id: "a", type: "CALL", created_at: "2026-07-01T00:00:00.000Z", ...o } as Activity;
}

const DAY = 24 * 60 * 60 * 1000;

describe("getLastContactedDate", () => {
  const acts = [act({ lead_id: "l1", completed_at: "2026-06-01T00:00:00.000Z" })];

  it("returns the later of lead.last_contacted_at and the latest activity", () => {
    expect(getLastContactedDate("l1", acts, { last_contacted_at: "2026-06-10T00:00:00.000Z" })).toBe("2026-06-10T00:00:00.000Z");
    expect(getLastContactedDate("l1", acts, { last_contacted_at: "2026-05-01T00:00:00.000Z" })).toBe("2026-06-01T00:00:00.000Z");
  });

  it("falls back to activity alone, lead alone, or null", () => {
    expect(getLastContactedDate("l1", acts)).toBe("2026-06-01T00:00:00.000Z");
    expect(getLastContactedDate("l1", [], { last_contacted_at: "2026-05-01T00:00:00.000Z" })).toBe("2026-05-01T00:00:00.000Z");
    expect(getLastContactedDate("l1", [])).toBeNull();
  });

  it("ignores deleted or uncompleted activities", () => {
    const noisy = [
      act({ lead_id: "l1", completed_at: "2026-06-01T00:00:00.000Z", deleted_at: "x" }),
      act({ lead_id: "l1" }), // no completed_at
    ];
    expect(getLastContactedDate("l1", noisy)).toBeNull();
  });
});

describe("activity selectors", () => {
  it("filter by entity, exclude deleted, sort newest-first", () => {
    const acts = [
      act({ id: "1", lead_id: "l1", created_at: "2026-01-01T00:00:00.000Z" }),
      act({ id: "2", lead_id: "l1", created_at: "2026-02-01T00:00:00.000Z" }),
      act({ id: "3", lead_id: "l1", deleted_at: "x" }),
      act({ id: "4", deal_id: "d1" }),
      act({ id: "5", contact_id: "c1" }),
    ];
    expect(getLeadActivities("l1", acts).map((a) => a.id)).toEqual(["2", "1"]);
    expect(getDealActivities("d1", acts).map((a) => a.id)).toEqual(["4"]);
    expect(getContactActivities("c1", acts).map((a) => a.id)).toEqual(["5"]);
  });
});

describe("getStaleDeals", () => {
  const deal = (o: Partial<Deal>): Deal =>
    ({ id: "d", stage: "APPOINTMENT", updated_at: "2026-01-01T00:00:00.000Z", ...o }) as Deal;

  it("returns active deals older than the threshold, excluding WON/LOST/deleted", () => {
    const old = new Date(Date.now() - 30 * DAY).toISOString();
    const fresh = new Date().toISOString();
    const deals = [
      deal({ id: "stale", updated_at: old }),
      deal({ id: "fresh", updated_at: fresh }),
      deal({ id: "won", stage: "WON", updated_at: old }),
      deal({ id: "del", updated_at: old, deleted_at: "x" }),
    ];
    expect(getStaleDeals(deals).map((d) => d.id)).toEqual(["stale"]);
  });
});

describe("getDaysSince", () => {
  it("counts whole elapsed days", () => {
    expect(getDaysSince(new Date(Date.now() - 3 * DAY).toISOString())).toBe(3);
  });
});

describe("getTodayCallStats", () => {
  it("counts today's calls, pickups, and call activity duration for the user", () => {
    const now = new Date().toISOString();
    const acts = [
      act({ type: "CALL", created_by: "u1", created_at: now, result: "COMPLETED", metadata: { duration_seconds: 120 } }),
      act({ type: "CALL", created_by: "u1", created_at: now, result: "NO_ANSWER", metadata: { duration_seconds: 30 } }),
      act({ type: "CALL", created_by: "other", created_at: now }),
    ];
    const sessions = [] as CallSession[];

    expect(getTodayCallStats(acts, "u1", sessions)).toEqual({
      callsMade: 2,
      pickups: 1,
      totalDurationSeconds: 150,
    });
  });

  it("uses saved session duration when call activities do not have duration metadata", () => {
    const now = new Date().toISOString();
    const acts = [
      act({ type: "CALL", created_by: "u1", created_at: now, result: "COMPLETED" }),
      act({ type: "CALL", created_by: "u1", created_at: now, result: "NO_ANSWER" }),
    ];
    const sessions = [{ user_id: "u1", started_at: now, total_duration_seconds: 600 }] as CallSession[];

    expect(getTodayCallStats(acts, "u1", sessions)).toEqual({
      callsMade: 2,
      pickups: 1,
      totalDurationSeconds: 600,
    });
  });
});
