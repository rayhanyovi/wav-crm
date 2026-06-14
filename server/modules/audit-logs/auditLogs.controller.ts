import type { Request, Response } from "express";
import { getActor } from "../../middleware/auth.js";
import * as service from "./auditLogs.service.js";
import type { ListQuery } from "./auditLogs.schema.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await service.listAuditLogs(getActor(req), req.query as unknown as ListQuery);
  res.json(result);
}
