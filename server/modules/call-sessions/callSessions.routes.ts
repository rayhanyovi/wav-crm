import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./callSessions.controller.js";
import { createCallSessionSchema } from "./callSessions.schema.js";

export const callSessionsRouter = Router();

callSessionsRouter.use(requireAuth());

callSessionsRouter.post(
  "/",
  validate({ body: createCallSessionSchema }),
  asyncHandler(controller.create),
);
