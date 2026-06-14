import type { User } from "@/data/types";

/**
 * Advisers that `actor` may assign an appointment deal to (spending one of that
 * adviser's credits). Only advisers with at least one credit are eligible.
 *
 *  - MASTER: any active adviser.
 *  - TELEMARKETER: advisers who delegated dealing access to them
 *    (`telemarketer_access` + `telemarketer_id === actor.id`).
 *  - everyone else (incl. plain advisers booking their own): none — the deal is
 *    left unassigned for the claim pool.
 *
 * When this returns more than one adviser the booking UI must make the TM choose
 * (requirement 2d); a single result can be defaulted; an empty result means the
 * deal stays unassigned.
 */
export function assignableAdvisersFor(actor: User | null | undefined, users: User[]): User[] {
  if (!actor?.is_active) return [];

  const hasCredit = (u: User) => (u.credit_balance ?? 0) > 0;

  if (actor.role === "MASTER") {
    return users.filter((u) => u.role === "ADVISER" && u.is_active && hasCredit(u));
  }

  if (actor.role === "TELEMARKETER") {
    return users.filter(
      (u) =>
        u.role === "ADVISER" &&
        u.is_active &&
        u.telemarketer_access &&
        u.telemarketer_id === actor.id &&
        hasCredit(u),
    );
  }

  return [];
}
