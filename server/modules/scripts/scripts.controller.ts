import type { Request, Response } from "express";
import { getActor } from "../../middleware/auth.js";
import * as service from "./scripts.service.js";
import type { CreateScriptInput, UpdateScriptInput } from "./scripts.schema.js";

export async function list(req: Request, res: Response): Promise<void> {
  const scripts = await service.listScripts(getActor(req));
  res.json({ data: scripts });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const script = await service.getScript(getActor(req), req.params.id as string);
  res.json({ data: script });
}

export async function create(req: Request, res: Response): Promise<void> {
  const script = await service.createScript(getActor(req), req.body as CreateScriptInput);
  res.status(201).json({ data: script });
}

export async function update(req: Request, res: Response): Promise<void> {
  const script = await service.updateScript(
    getActor(req),
    req.params.id as string,
    req.body as UpdateScriptInput,
  );
  res.json({ data: script });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.deleteScript(getActor(req), req.params.id as string);
  res.status(204).send();
}
