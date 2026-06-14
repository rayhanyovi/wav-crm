import type { Request, Response } from "express";
import { getActor } from "../../middleware/auth.js";
import * as service from "./callSessions.service.js";
import type { CreateCallSessionInput } from "./callSessions.schema.js";

export async function create(req: Request, res: Response): Promise<void> {
  const session = await service.saveCallSession(getActor(req), req.body as CreateCallSessionInput);
  res.status(201).json({ data: session });
}
