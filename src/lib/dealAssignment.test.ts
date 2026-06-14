import { describe, expect, it } from "vitest";
import type { User, UserRole } from "@/data/types";
import { assignableAdvisersFor } from "./dealAssignment";

function user(overrides: Partial<User> & { id: string; role: UserRole }): User {
  return {
    name: overrides.id,
    email: `${overrides.id}@wav.sg`,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    credit_balance: 0,
    ...overrides,
  };
}

describe("assignableAdvisersFor", () => {
  it("returns nothing for a pure telemarketer with no granting advisers", () => {
    const tm = user({ id: "tm", role: "TELEMARKETER" });
    const adviser = user({ id: "adv", role: "ADVISER", credit_balance: 3 });
    expect(assignableAdvisersFor(tm, [tm, adviser])).toEqual([]);
  });

  it("returns advisers who delegated to the TM and still have credit", () => {
    const tm = user({ id: "tm", role: "TELEMARKETER" });
    const granting = user({
      id: "adv-1",
      role: "ADVISER",
      credit_balance: 2,
      telemarketer_access: true,
      telemarketer_id: "tm",
    });
    const grantingBroke = user({
      id: "adv-2",
      role: "ADVISER",
      credit_balance: 0,
      telemarketer_access: true,
      telemarketer_id: "tm",
    });
    const otherTmsAdviser = user({
      id: "adv-3",
      role: "ADVISER",
      credit_balance: 5,
      telemarketer_access: true,
      telemarketer_id: "tm-other",
    });

    const result = assignableAdvisersFor(tm, [tm, granting, grantingBroke, otherTmsAdviser]);
    expect(result.map((u) => u.id)).toEqual(["adv-1"]);
  });

  it("returns multiple granting advisers (forcing the TM to choose)", () => {
    const tm = user({ id: "tm", role: "TELEMARKETER" });
    const a = user({ id: "a", role: "ADVISER", credit_balance: 1, telemarketer_access: true, telemarketer_id: "tm" });
    const b = user({ id: "b", role: "ADVISER", credit_balance: 1, telemarketer_access: true, telemarketer_id: "tm" });
    expect(assignableAdvisersFor(tm, [tm, a, b]).map((u) => u.id)).toEqual(["a", "b"]);
  });

  it("lets a MASTER assign to any active adviser with credit", () => {
    const master = user({ id: "m", role: "MASTER" });
    const withCredit = user({ id: "adv-1", role: "ADVISER", credit_balance: 4 });
    const noCredit = user({ id: "adv-2", role: "ADVISER", credit_balance: 0 });
    expect(assignableAdvisersFor(master, [master, withCredit, noCredit]).map((u) => u.id)).toEqual([
      "adv-1",
    ]);
  });

  it("returns nothing for a plain adviser booking their own appointment", () => {
    const adviser = user({ id: "adv", role: "ADVISER", credit_balance: 3 });
    expect(assignableAdvisersFor(adviser, [adviser])).toEqual([]);
  });
});
