import type { User, UserRole } from "@/data/types";

const roleLevels: Record<UserRole, number> = {
  ADMIN: 3,
  MANAGER: 2,
  SALES: 1,
  VIEWER: 0,
};

export function roleLevel(role: UserRole): number {
  return roleLevels[role];
}

export function can(user: User | null, minRole: UserRole): boolean {
  if (!user) return false;
  return roleLevels[user.role] >= roleLevels[minRole];
}

export function canEdit(user: User | null): boolean {
  return can(user, "SALES");
}

export function canManage(user: User | null): boolean {
  return can(user, "MANAGER");
}

export function canAdmin(user: User | null): boolean {
  return can(user, "ADMIN");
}

export function isOwner(user: User | null, ownerId: string | undefined): boolean {
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "MANAGER") return true;
  return user.id === ownerId;
}
