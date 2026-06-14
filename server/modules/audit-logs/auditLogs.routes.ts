import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./auditLogs.controller.js";
import { listQuerySchema } from "./auditLogs.schema.js";

export const auditLogsRouter = Router();

auditLogsRouter.use(requireAuth());

auditLogsRouter.get("/", validate({ query: listQuerySchema }), asyncHandler(controller.list));
