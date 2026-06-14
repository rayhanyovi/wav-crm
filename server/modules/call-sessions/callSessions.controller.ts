import type { Request, Response } from "express";
import { getActor } from "../../middleware/auth.js";
import * as service from "./callSessions.service.js";
import type { CreateCallSessionInput, ListQuery } from "./callSessions.schema.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await service.listCallSessions(getActor(req), req.query as unknown as ListQuery);
  res.json(result);
}

export async function create(req: Request, res: Response): Promise<void> {
  const session = await service.saveCallSession(getActor(req), req.body as CreateCallSessionInput);
  res.status(201).json({ data: session });
}
