import { describe, expect, it } from "vitest";
import type { Actor } from "../../middleware/context.js";
import {
  canCreateActivity,
  canDeleteActivity,
  canListActivities,
  canMutateActivity,
  canViewActivity,
} from "./activities.authz.js";

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

describe("activities authz", () => {
  describe("canListActivities / canCreateActivity", () => {
    it("allows all roles", () => {
      for (const role of ["MASTER", "ADVISER", "TELEMARKETER"] as const) {
        expect(canListActivities(actor({ role }))).toBe(true);
        expect(canCreateActivity(actor({ role }))).toBe(true);
      }
    });
  });

  describe("canViewActivity", () => {
    it("MASTER can view anything", () => {
      expect(canViewActivity(actor({ role: "MASTER" }), { createdBy: "other", assignedToId: null })).toBe(true);
    });

    it("creator can view their own activity", () => {
      expect(canViewActivity(actor({ id: "u1" }), { createdBy: "u1", assignedToId: null })).toBe(true);
    });

    it("assignee can view their activity", () => {
      expect(canViewActivity(actor({ id: "u1" }), { createdBy: "other", assignedToId: "u1" })).toBe(true);
    });

    it("unrelated user cannot view", () => {
      expect(canViewActivity(actor({ id: "u1" }), { createdBy: "other", assignedToId: "other2" })).toBe(false);
    });
  });

  describe("canMutateActivity", () => {
    it("MASTER can mutate any", () => {
      expect(canMutateActivity(actor({ role: "MASTER" }), { createdBy: "someone" })).toBe(true);
    });

    it("creator can mutate their own", () => {
      expect(canMutateActivity(actor({ id: "u1" }), { createdBy: "u1" })).toBe(true);
    });

    it("non-creator cannot mutate", () => {
      expect(canMutateActivity(actor({ id: "u1" }), { createdBy: "other" })).toBe(false);
    });
  });

  describe("canDeleteActivity", () => {
    it("only MASTER can delete", () => {
      expect(canDeleteActivity(actor({ role: "MASTER" }))).toBe(true);
      expect(canDeleteActivity(actor({ role: "ADVISER" }))).toBe(false);
      expect(canDeleteActivity(actor({ role: "TELEMARKETER" }))).toBe(false);
    });
  });
});
