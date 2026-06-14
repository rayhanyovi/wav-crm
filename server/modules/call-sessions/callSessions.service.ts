import type { CallSession } from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import { ConflictError, ForbiddenError } from "../../lib/errors.js";
import type { Actor } from "../../middleware/context.js";
import { canCreateCallSession } from "./callSessions.authz.js";
import type { CreateCallSessionInput } from "./callSessions.schema.js";

export async function saveCallSession(
  actor: Actor,
  input: CreateCallSessionInput,
): Promise<CallSession> {
  if (!canCreateCallSession(actor)) throw new ForbiddenError("Not allowed to save call sessions");

  const existing = await prisma.callSession.findUnique({ where: { id: input.id } });
  if (existing) throw new ConflictError("Call session already exists");

  return prisma.callSession.create({
    data: {
      id: input.id,
      userId: actor.id,
      startedAt: new Date(input.started_at),
      endedAt: input.ended_at ? new Date(input.ended_at) : undefined,
      totalDurationSeconds: input.total_duration_seconds,
      callsMade: input.calls_made,
      pickups: input.pickups,
      leadIds: input.lead_ids,
    },
  });
}
