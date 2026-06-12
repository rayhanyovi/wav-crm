import { describe, expect, it } from "vitest";
import type { Lead, User, UserRole } from "@/data/types";
import {
  nextCreditBalanceAfterAppointmentClaim,
  resolveAppointmentDealAdviser,
} from "./dealAssignment";

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

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    first_name: "Test",
    last_name: "Lead",
    source: "OWN_SOURCE",
    status: "NA",
    created_by: "usr-master",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("resolveAppointmentDealAdviser", () => {
  it("leaves deals unassigned for a pure telemarketer", () => {
    const telemarketer = user({ id: "tm-1", role: "TELEMARKETER" });
    const junhao = user({ id: "adv-1", role: "ADVISER", credit_balance: 3 });

    expect(
      resolveAppointmentDealAdviser({
        actor: telemarketer,
        lead: lead({ assigned_to_id: junhao.id }),
        users: [telemarketer, junhao],
      }),
    ).toBeUndefined();
  });

  it("assigns an adviser actor to himself when he has credit", () => {
    const adviser = user({ id: "adv-1", role: "ADVISER", credit_balance: 2 });

    expect(
      resolveAppointmentDealAdviser({
        actor: adviser,
        users: [adviser],
      })?.id,
    ).toBe(adviser.id);
  });

  it("leaves an adviser actor's deal unassigned when he has no credit", () => {
    const adviser = user({ id: "adv-1", role: "ADVISER", credit_balance: 0 });

    expect(
      resolveAppointmentDealAdviser({
        actor: adviser,
        users: [adviser],
      }),
    ).toBeUndefined();
  });

  it("assigns the single granting adviser for a telemarketer with dealing access", () => {
    const telemarketer = user({ id: "tm-1", role: "TELEMARKETER" });
    const adviser = user({
      id: "adv-1",
      role: "ADVISER",
      credit_balance: 4,
      telemarketer_access: true,
      telemarketer_id: telemarketer.id,
    });

    expect(
      resolveAppointmentDealAdviser({
        actor: telemarketer,
        users: [telemarketer, adviser],
      })?.id,
    ).toBe(adviser.id);
  });

  it("leaves a granted telemarketer's deal unassigned when the adviser has no credit", () => {
    const telemarketer = user({ id: "tm-1", role: "TELEMARKETER" });
    const adviser = user({
      id: "adv-1",
      role: "ADVISER",
      credit_balance: 0,
      telemarketer_access: true,
      telemarketer_id: telemarketer.id,
    });

    expect(
      resolveAppointmentDealAdviser({
        actor: telemarketer,
        users: [telemarketer, adviser],
      }),
    ).toBeUndefined();
  });

  it("prefers the lead's adviser when multiple advisers grant access", () => {
    const telemarketer = user({ id: "tm-1", role: "TELEMARKETER" });
    const junhao = user({
      id: "adv-junhao",
      role: "ADVISER",
      credit_balance: 3,
      telemarketer_access: true,
      telemarketer_id: telemarketer.id,
    });
    const javier = user({
      id: "adv-javier",
      role: "ADVISER",
      credit_balance: 3,
      telemarketer_access: true,
      telemarketer_id: telemarketer.id,
    });

    expect(
      resolveAppointmentDealAdviser({
        actor: telemarketer,
        lead: lead({ adviser_owner_id: javier.id }),
        users: [telemarketer, junhao, javier],
      })?.id,
    ).toBe(javier.id);
  });

  it("does not pick an arbitrary adviser when multiple grantors match no lead owner", () => {
    const telemarketer = user({ id: "tm-1", role: "TELEMARKETER" });
    const junhao = user({
      id: "adv-junhao",
      role: "ADVISER",
      credit_balance: 3,
      telemarketer_access: true,
      telemarketer_id: telemarketer.id,
    });
    const javier = user({
      id: "adv-javier",
      role: "ADVISER",
      credit_balance: 3,
      telemarketer_access: true,
      telemarketer_id: telemarketer.id,
    });

    expect(
      resolveAppointmentDealAdviser({
        actor: telemarketer,
        users: [telemarketer, junhao, javier],
      }),
    ).toBeUndefined();
  });
});

describe("nextCreditBalanceAfterAppointmentClaim", () => {
  it("spends one credit without going below zero", () => {
    expect(
      nextCreditBalanceAfterAppointmentClaim(
        user({ id: "adv-1", role: "ADVISER", credit_balance: 2 }),
      ),
    ).toBe(1);
    expect(
      nextCreditBalanceAfterAppointmentClaim(
        user({ id: "adv-1", role: "ADVISER", credit_balance: 0 }),
      ),
    ).toBe(0);
  });
});
