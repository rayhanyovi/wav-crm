import type { Request, Response } from "express";
import { getActor } from "../../middleware/auth.js";
import * as service from "./notifications.service.js";
import type { ListQuery } from "./notifications.schema.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await service.listNotifications(getActor(req), req.query as unknown as ListQuery);
  res.json(result);
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const notification = await service.markRead(getActor(req), req.params.id as string);
  res.json({ data: notification });
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  const result = await service.markAllRead(getActor(req));
  res.json({ data: result });
}
