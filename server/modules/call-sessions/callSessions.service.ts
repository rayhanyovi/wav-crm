import type { CallSession } from "../../../prisma/generated/client/index.js";
import { prisma } from "../../lib/prisma.js";
import { ConflictError, ForbiddenError } from "../../lib/errors.js";
import type { Actor } from "../../middleware/context.js";
import { canCreateCallSession, canListCallSessions } from "./callSessions.authz.js";
import type { CreateCallSessionInput, ListQuery } from "./callSessions.schema.js";

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listCallSessions(
  actor: Actor,
  query: ListQuery,
): Promise<Paginated<CallSession>> {
  if (!canListCallSessions(actor)) throw new ForbiddenError("Not allowed to view call sessions");

  const where = actor.role === "MASTER" ? {} : { userId: actor.id };
  const [data, total] = await Promise.all([
    prisma.callSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.callSession.count({ where }),
  ]);

  return { data, total, page: query.page, pageSize: query.pageSize };
}

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
