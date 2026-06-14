import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./activities.controller.js";
import {
  addCommentSchema,
  createActivitySchema,
  idParamSchema,
  listQuerySchema,
  updateActivitySchema,
} from "./activities.schema.js";

export const activitiesRouter = Router();

activitiesRouter.use(requireAuth());

activitiesRouter.get("/", validate({ query: listQuerySchema }), asyncHandler(controller.list));
activitiesRouter.post("/", validate({ body: createActivitySchema }), asyncHandler(controller.create));
activitiesRouter.get("/:id", validate({ params: idParamSchema }), asyncHandler(controller.getById));
activitiesRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateActivitySchema }),
  asyncHandler(controller.update),
);
activitiesRouter.delete("/:id", validate({ params: idParamSchema }), asyncHandler(controller.remove));

activitiesRouter.get(
  "/:id/comments",
  validate({ params: idParamSchema }),
  asyncHandler(controller.getComments),
);
activitiesRouter.post(
  "/:id/comments",
  validate({ params: idParamSchema, body: addCommentSchema }),
  asyncHandler(controller.addComment),
);
