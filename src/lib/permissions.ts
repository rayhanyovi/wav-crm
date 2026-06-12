import type { User, UserRole } from "@/data/types";

const roleLevels: Record<UserRole, number> = {
  MASTER:      2,
  ADVISER:     1,
  TELEMARKETER: 0,
};

export function roleLevel(role: UserRole): number {
  return roleLevels[role];
}

export function can(user: User | null, minRole: UserRole): boolean {
  if (!user) return false;
  return roleLevels[user.role] >= roleLevels[minRole];
}

/** Can create / edit leads and log activities */
export function canEdit(user: User | null): boolean {
  return can(user, "ADVISER");
}

/** Can see all advisers' leads, manage team */
export function canManage(user: User | null): boolean {
  return can(user, "MASTER");
}

/** Alias for canManage — kept for call-site compatibility */
export function canAdmin(user: User | null): boolean {
  return can(user, "MASTER");
}

/** True if user owns the record OR is a Master account */
export function isOwner(user: User | null, ownerId: string | undefined): boolean {
  if (!user) return false;
  if (user.role === "MASTER") return true;
  return user.id === ownerId;
}

/** True if user is a Master account */
export function isMaster(user: User | null): boolean {
  return user?.role === "MASTER";
}

/** True if user is an Adviser */
export function isAdviser(user: User | null): boolean {
  return user?.role === "ADVISER";
}

/** True if user is a Telemarketer */
export function isTelemarketer(user: User | null): boolean {
  return user?.role === "TELEMARKETER";
}

/** Can log call/meeting activities (TM, Adviser, and Master) */
export function canLogActivity(user: User | null): boolean {
  return can(user, "TELEMARKETER");
}

/**
 * Whether this user can access the Leads module.
 * Master-controlled per-Adviser toggle (`leads_access`, default true);
 * TMs and Masters always have access.
 */
export function hasLeadsAccess(user: User | null): boolean {
  if (!user) return false;
  if (user.role !== "ADVISER") return true;
  return user.leads_access ?? true;
}
