import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./notifications.controller.js";
import { idParamSchema, listQuerySchema } from "./notifications.schema.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth());

notificationsRouter.get("/", validate({ query: listQuerySchema }), asyncHandler(controller.list));

// mark-all-read must come before /:id to avoid param capture
notificationsRouter.patch("/read-all", asyncHandler(controller.markAllRead));

notificationsRouter.patch(
  "/:id/read",
  validate({ params: idParamSchema }),
  asyncHandler(controller.markRead),
);
