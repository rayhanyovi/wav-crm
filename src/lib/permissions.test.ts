import { describe, it, expect } from "vitest";
import {
  roleLevel,
  can,
  canEdit,
  canManage,
  canAdmin,
  isOwner,
  isMaster,
  isAdviser,
  isTelemarketer,
  canLogActivity,
} from "./permissions";
import type { User, UserRole } from "@/data/types";

function makeUser(role: UserRole, id = "usr-1"): User {
  return {
    id,
    name: "Test",
    email: "test@sg-alliance.com",
    role,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const master = makeUser("MASTER", "usr-master");
const adviser = makeUser("ADVISER", "usr-adviser");
const tele = makeUser("TELEMARKETER", "usr-tele");

describe("roleLevel", () => {
  it("orders roles MASTER > ADVISER > TELEMARKETER", () => {
    expect(roleLevel("MASTER")).toBeGreaterThan(roleLevel("ADVISER"));
    expect(roleLevel("ADVISER")).toBeGreaterThan(roleLevel("TELEMARKETER"));
  });
});

describe("can", () => {
  it("returns false for a null user", () => {
    expect(can(null, "TELEMARKETER")).toBe(false);
  });
  it("grants when the user meets or exceeds the threshold", () => {
    expect(can(master, "ADVISER")).toBe(true);
    expect(can(adviser, "ADVISER")).toBe(true);
    expect(can(tele, "ADVISER")).toBe(false);
  });
});

describe("role shortcuts", () => {
  it("canEdit requires ADVISER or higher", () => {
    expect(canEdit(master)).toBe(true);
    expect(canEdit(adviser)).toBe(true);
    expect(canEdit(tele)).toBe(false);
    expect(canEdit(null)).toBe(false);
  });
  it("canManage / canAdmin require MASTER", () => {
    expect(canManage(master)).toBe(true);
    expect(canManage(adviser)).toBe(false);
    expect(canAdmin(master)).toBe(true);
    expect(canAdmin(tele)).toBe(false);
  });
  it("canLogActivity allows all roles", () => {
    expect(canLogActivity(master)).toBe(true);
    expect(canLogActivity(adviser)).toBe(true);
    expect(canLogActivity(tele)).toBe(true);
    expect(canLogActivity(null)).toBe(false);
  });
});

describe("isOwner", () => {
  it("is true for the record owner", () => {
    expect(isOwner(adviser, "usr-adviser")).toBe(true);
  });
  it("is false for a non-owner adviser", () => {
    expect(isOwner(adviser, "usr-someone-else")).toBe(false);
  });
  it("is always true for MASTER regardless of owner", () => {
    expect(isOwner(master, "usr-someone-else")).toBe(true);
  });
  it("is false for null user", () => {
    expect(isOwner(null, "usr-adviser")).toBe(false);
  });
});

describe("role predicates", () => {
  it("identify the exact role", () => {
    expect(isMaster(master)).toBe(true);
    expect(isMaster(adviser)).toBe(false);
    expect(isAdviser(adviser)).toBe(true);
    expect(isTelemarketer(tele)).toBe(true);
    expect(isMaster(null)).toBe(false);
  });
});
