import type { Actor } from "../../middleware/context.js";

/** All roles can list activities (query is filtered per role in service). */
export function canListActivities(_actor: Actor): boolean {
  return true;
}

/** All roles can create activities. */
export function canCreateActivity(_actor: Actor): boolean {
  return true;
}

/**
 * MASTER can view any activity.
 * Others can view activities they created or are assigned to.
 */
export function canViewActivity(
  actor: Actor,
  activity: { createdBy: string; assignedToId: string | null },
): boolean {
  if (actor.role === "MASTER") return true;
  return activity.createdBy === actor.id || activity.assignedToId === actor.id;
}

/**
 * MASTER or the creator can mutate an activity.
 */
export function canMutateActivity(
  actor: Actor,
  activity: { createdBy: string },
): boolean {
  if (actor.role === "MASTER") return true;
  return activity.createdBy === actor.id;
}

/** Only MASTER can delete activities. */
export function canDeleteActivity(actor: Actor): boolean {
  return actor.role === "MASTER";
}
