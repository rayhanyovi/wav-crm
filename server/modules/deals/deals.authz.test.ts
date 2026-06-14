import { describe, expect, it } from "vitest";
import type { Actor } from "../../middleware/context.js";
import {
  canClaimDeal,
  canCreateDeal,
  canDeleteDeal,
  canListDeals,
  canMutateDeal,
  canViewDeal,
} from "./deals.authz.js";

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: "u1",
    authUserId: "auth-1",
    email: "a@b.c",
    role: "ADVISER",
    isActive: true,
    creditBalance: 3,
    telemarketerAccess: false,
    telemarketerId: null,
    leadsAccess: true,
    delegatedAdviserIds: [],
    ...overrides,
  };
}

const openDeal = { assignedToId: null, telemarketerId: null };
const ownedDeal = { assignedToId: "u1", telemarketerId: null };
const otherDeal = { assignedToId: "other", telemarketerId: null };
const tmDeal = { assignedToId: null, telemarketerId: "tm-1" };

describe("canListDeals", () => {
  it("allows every role", () => {
    for (const role of ["MASTER", "ADVISER", "TELEMARKETER"] as const) {
      expect(canListDeals(actor({ role }))).toBe(true);
    }
  });
});

describe("canCreateDeal", () => {
  it("allows MASTER and ADVISER", () => {
    expect(canCreateDeal(actor({ role: "MASTER" }))).toBe(true);
    expect(canCreateDeal(actor({ role: "ADVISER" }))).toBe(true);
  });

  it("denies TELEMARKETER", () => {
    expect(canCreateDeal(actor({ role: "TELEMARKETER" }))).toBe(false);
  });
});

describe("canViewDeal", () => {
  it("MASTER can view any deal", () => {
    expect(canViewDeal(actor({ role: "MASTER" }), otherDeal)).toBe(true);
    expect(canViewDeal(actor({ role: "MASTER" }), openDeal)).toBe(true);
  });

  it("ADVISER can view their own or open deals", () => {
    expect(canViewDeal(actor({ id: "u1" }), ownedDeal)).toBe(true);
    expect(canViewDeal(actor({ id: "u1" }), openDeal)).toBe(true);
  });

  it("ADVISER cannot view deals owned by someone else", () => {
    expect(canViewDeal(actor({ id: "u1" }), otherDeal)).toBe(false);
  });

  it("TELEMARKETER can view deals linked to their leads", () => {
    expect(canViewDeal(actor({ role: "TELEMARKETER", id: "tm-1" }), tmDeal)).toBe(true);
  });

  it("TELEMARKETER cannot view unrelated deals", () => {
    expect(canViewDeal(actor({ role: "TELEMARKETER", id: "tm-2" }), tmDeal)).toBe(false);
  });

  it("delegated TELEMARKETER can view a deal assigned to a granting adviser", () => {
    const tm = actor({ role: "TELEMARKETER", id: "tm-1", delegatedAdviserIds: ["adv-1"] });
    expect(canViewDeal(tm, { assignedToId: "adv-1", telemarketerId: null })).toBe(true);
    expect(canViewDeal(tm, { assignedToId: "adv-x", telemarketerId: null })).toBe(false);
  });
});

describe("canMutateDeal", () => {
  it("MASTER can mutate any deal", () => {
    expect(canMutateDeal(actor({ role: "MASTER" }), otherDeal)).toBe(true);
    expect(canMutateDeal(actor({ role: "MASTER" }), openDeal)).toBe(true);
  });

  it("ADVISER can mutate their own deal", () => {
    expect(canMutateDeal(actor({ id: "u1" }), ownedDeal)).toBe(true);
  });

  it("ADVISER cannot mutate an open or someone else's deal", () => {
    expect(canMutateDeal(actor({ id: "u1" }), openDeal)).toBe(false);
    expect(canMutateDeal(actor({ id: "u1" }), otherDeal)).toBe(false);
  });

  it("TELEMARKETER cannot mutate deals by default", () => {
    expect(canMutateDeal(actor({ role: "TELEMARKETER" }), tmDeal)).toBe(false);
  });

  it("delegated TELEMARKETER can mutate a deal assigned to a granting adviser", () => {
    const tm = actor({ role: "TELEMARKETER", id: "tm-1", delegatedAdviserIds: ["adv-1"] });
    expect(canMutateDeal(tm, { assignedToId: "adv-1" })).toBe(true);
    expect(canMutateDeal(tm, { assignedToId: "adv-x" })).toBe(false);
    expect(canMutateDeal(tm, { assignedToId: null })).toBe(false);
  });
});

describe("canClaimDeal", () => {
  it("allows MASTER and ADVISER", () => {
    expect(canClaimDeal(actor({ role: "MASTER" }))).toBe(true);
    expect(canClaimDeal(actor({ role: "ADVISER" }))).toBe(true);
  });

  it("denies TELEMARKETER", () => {
    expect(canClaimDeal(actor({ role: "TELEMARKETER" }))).toBe(false);
  });
});

describe("canDeleteDeal", () => {
  it("allows only MASTER", () => {
    expect(canDeleteDeal(actor({ role: "MASTER" }))).toBe(true);
    expect(canDeleteDeal(actor({ role: "ADVISER" }))).toBe(false);
    expect(canDeleteDeal(actor({ role: "TELEMARKETER" }))).toBe(false);
  });
});
