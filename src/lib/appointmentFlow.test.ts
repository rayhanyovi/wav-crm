import { describe, expect, it } from "vitest";
import type { Lead, User, UserRole } from "@/data/types";
import {
  nextCreditBalanceAfterAppointmentClaim,
  resolveAppointmentDealAdviser,
} from "./dealAssignment";

// ─── Factories (mirrors dealAssignment.test.ts) ────────────────────────────────

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
    id: "lead-aaron",
    first_name: "Aaron",
    last_name: "Jie",
    source: "AP_MARKETING",
    status: "NA",
    created_by: "usr-master",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * When a lead is moved to APPOINTMENT, the deal that gets created is assigned to
 * whoever `resolveAppointmentDealAdviser` returns (and that adviser spends a
 * credit), or left unassigned (claimable by anyone) when it returns undefined.
 *
 * "Claiming" an unassigned appointment deal later is the same eligibility check
 * with the claiming adviser as the actor.
 *
 * Persona map (the function keys off the ACTOR's role):
 *   A. Pure telemarketer .................. TELEMARKETER, no granting adviser
 *   B. Pure adviser ....................... ADVISER actor
 *   C. Adviser who also telemarkets ....... ADVISER actor (behaves exactly like B)
 *   D. Telemarketer granted dealing access  TELEMARKETER + an adviser with
 *                                           telemarketer_access pointing at them
 */
function moveToAppointment(actor: User, users: User[], theLead?: Lead) {
  const adviser = resolveAppointmentDealAdviser({ actor, lead: theLead, users });
  return {
    assignedAdviserId: adviser?.id, // undefined == unassigned / claimable by anyone
    adviser,
  };
}

// ─── Case A (GOLDEN): Telemarketer → Adviser → Appointment → Win ───────────────

describe("Golden flow — pure Telemarketer hands off, Adviser claims and wins", () => {
  it("creates an unassigned deal that an adviser then claims, spends a credit, and wins", () => {
    // 1–3. A lead exists; a pure telemarketer calls and the client wants to meet.
    const tm = user({ id: "tm-grace", role: "TELEMARKETER" });
    const junhao = user({ id: "adv-junhao", role: "ADVISER", credit_balance: 3 });
    const theLead = lead();
    const users = [tm, junhao];

    // 4. The telemarketer books the appointment → deal is created UNASSIGNED.
    const { assignedAdviserId } = moveToAppointment(tm, users, theLead);
    expect(assignedAdviserId).toBeUndefined();

    // 5. An adviser sees the unclaimed prospect on the Deals page and claims it.
    //    Claim eligibility == being the actor of the appointment.
    const claimant = resolveAppointmentDealAdviser({ actor: junhao, users });
    expect(claimant?.id).toBe(junhao.id);

    // Claiming spends exactly one credit.
    expect(nextCreditBalanceAfterAppointmentClaim(junhao)).toBe(2);

    // 6–11. They meet, fact-find, agree, paperwork happens off-system, then WON.
    //       Once claimed, the deal is owned by the claiming adviser through to WON.
    const claimedDeal = { assigned_to_id: junhao.id, stage: "WON" as const };
    expect(claimedDeal.assigned_to_id).toBe(junhao.id);
    expect(claimedDeal.stage).toBe("WON");
  });

  it("leaves the deal in the open pool when no adviser has a credit to claim with", () => {
    const tm = user({ id: "tm-grace", role: "TELEMARKETER" });
    const brokeAdviser = user({ id: "adv-broke", role: "ADVISER", credit_balance: 0 });
    const users = [tm, brokeAdviser];

    expect(moveToAppointment(tm, users).assignedAdviserId).toBeUndefined();
    // A credit-less adviser cannot claim it either.
    expect(resolveAppointmentDealAdviser({ actor: brokeAdviser, users })).toBeUndefined();
  });
});

// ─── Case B & C: Adviser (incl. adviser who also telemarkets) books directly ───

describe("Adviser books the appointment directly (Persona B / C)", () => {
  it("auto-claims to himself when he has credit, spending one", () => {
    const javier = user({ id: "adv-javier", role: "ADVISER", credit_balance: 1 });

    expect(moveToAppointment(javier, [javier]).assignedAdviserId).toBe(javier.id);
    expect(nextCreditBalanceAfterAppointmentClaim(javier)).toBe(0);
  });

  it("is left claimable by anyone when he has no credit", () => {
    const javier = user({ id: "adv-javier", role: "ADVISER", credit_balance: 0 });

    expect(moveToAppointment(javier, [javier]).assignedAdviserId).toBeUndefined();
  });

  it("treats an adviser who also telemarkets identically to a pure adviser", () => {
    // Persona C is still an ADVISER actor; telemarketer_access on his own row
    // (he supervises a TM) does not change self-claim behaviour.
    const hybrid = user({
      id: "adv-hybrid",
      role: "ADVISER",
      credit_balance: 2,
      telemarketer_access: true,
      telemarketer_id: "tm-someone",
    });

    expect(moveToAppointment(hybrid, [hybrid]).assignedAdviserId).toBe(hybrid.id);
  });
});

// ─── Case D: Telemarketer granted dealing access by an adviser ─────────────────

describe("Telemarketer with granted dealing access books the appointment (Persona D)", () => {
  it("auto-claims to the granting adviser when that adviser has credit", () => {
    const tm = user({ id: "tm-d", role: "TELEMARKETER" });
    const grantor = user({
      id: "adv-grantor",
      role: "ADVISER",
      credit_balance: 2,
      telemarketer_access: true,
      telemarketer_id: tm.id,
    });
    const users = [tm, grantor];

    const { assignedAdviserId, adviser } = moveToAppointment(tm, users);
    expect(assignedAdviserId).toBe(grantor.id);
    expect(nextCreditBalanceAfterAppointmentClaim(adviser!)).toBe(1);
  });

  it("falls back to the open pool when the granting adviser is out of credit", () => {
    const tm = user({ id: "tm-d", role: "TELEMARKETER" });
    const grantor = user({
      id: "adv-grantor",
      role: "ADVISER",
      credit_balance: 0,
      telemarketer_access: true,
      telemarketer_id: tm.id,
    });

    expect(moveToAppointment(tm, [tm, grantor]).assignedAdviserId).toBeUndefined();
  });

  it("routes to the lead's own adviser when several advisers grant the TM access", () => {
    const tm = user({ id: "tm-d", role: "TELEMARKETER" });
    const junhao = user({
      id: "adv-junhao",
      role: "ADVISER",
      credit_balance: 3,
      telemarketer_access: true,
      telemarketer_id: tm.id,
    });
    const javier = user({
      id: "adv-javier",
      role: "ADVISER",
      credit_balance: 3,
      telemarketer_access: true,
      telemarketer_id: tm.id,
    });

    // The lead already belongs to Javier → it should route back to Javier.
    const owned = lead({ adviser_owner_id: javier.id });
    expect(moveToAppointment(tm, [tm, junhao, javier], owned).assignedAdviserId).toBe(javier.id);

    // With no owning adviser, an ambiguous multi-grantor case stays unassigned.
    expect(moveToAppointment(tm, [tm, junhao, javier]).assignedAdviserId).toBeUndefined();
  });
});
