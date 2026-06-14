import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError } from "../../lib/errors.js";
import type { Actor } from "../../middleware/context.js";
import type { CreateScriptInput, UpdateScriptInput } from "./scripts.schema.js";

function requireMaster(actor: Actor) {
  if (actor.role !== "MASTER") throw new ForbiddenError("Only MASTER can manage scripts.");
}

export async function listScripts(actor: Actor) {
  void actor; // all roles can read
  const rows = await prisma.script.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

export async function getScript(actor: Actor, id: string) {
  void actor;
  const script = await prisma.script.findFirst({ where: { id, deletedAt: null } });
  if (!script) throw new NotFoundError("Script not found.");
  return script;
}

export async function createScript(actor: Actor, input: CreateScriptInput) {
  requireMaster(actor);
  return prisma.script.create({
    data: { title: input.title, content: input.content, createdBy: actor.id },
  });
}

export async function updateScript(actor: Actor, id: string, input: UpdateScriptInput) {
  requireMaster(actor);
  const existing = await prisma.script.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Script not found.");
  return prisma.script.update({ where: { id }, data: { ...input, updatedAt: new Date() } });
}

export async function deleteScript(actor: Actor, id: string) {
  requireMaster(actor);
  const existing = await prisma.script.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Script not found.");
  await prisma.script.update({ where: { id }, data: { deletedAt: new Date() } });
}
