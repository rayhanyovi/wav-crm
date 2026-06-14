import type { Request, Response } from "express";
import { getActor } from "../../middleware/auth.js";
import * as service from "./users.service.js";
import type { ListQuery, UpdateUserInput } from "./users.schema.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await service.listUsers(getActor(req), req.query as unknown as ListQuery);
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const user = await service.getUser(getActor(req), req.params.id as string);
  res.json({ data: user });
}

export async function update(req: Request, res: Response): Promise<void> {
  const user = await service.updateUser(
    getActor(req),
    req.params.id as string,
    req.body as UpdateUserInput,
  );
  res.json({ data: user });
}
