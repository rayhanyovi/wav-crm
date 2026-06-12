import type { Lead, User } from "@/data/types";

type LeadAdviserFields = Pick<Lead, "assigned_to_id" | "adviser_owner_id">;

function hasAppointmentClaimCredit(user: User | undefined): user is User {
  return !!user && user.role === "ADVISER" && user.is_active && (user.credit_balance ?? 0) > 0;
}

export function resolveAppointmentDealAdviser({
  actor,
  lead,
  users,
}: {
  actor: User | null | undefined;
  lead?: Partial<LeadAdviserFields>;
  users: User[];
}): User | undefined {
  if (!actor?.is_active) return undefined;

  const freshActor = users.find((user) => user.id === actor.id) ?? actor;

  if (freshActor.role === "ADVISER") {
    return hasAppointmentClaimCredit(freshActor) ? freshActor : undefined;
  }

  if (freshActor.role !== "TELEMARKETER") return undefined;

  const grantingAdvisers = users.filter(
    (user) =>
      user.role === "ADVISER" &&
      user.is_active &&
      user.telemarketer_access &&
      user.telemarketer_id === freshActor.id &&
      (user.credit_balance ?? 0) > 0,
  );

  const preferredAdviserIds = [lead?.adviser_owner_id, lead?.assigned_to_id].filter(
    (id): id is string => !!id,
  );

  for (const adviserId of preferredAdviserIds) {
    const adviser = grantingAdvisers.find((user) => user.id === adviserId);
    if (adviser) return adviser;
  }

  return grantingAdvisers.length === 1 ? grantingAdvisers[0] : undefined;
}

export function nextCreditBalanceAfterAppointmentClaim(user: User): number {
  return Math.max(0, (user.credit_balance ?? 0) - 1);
}
