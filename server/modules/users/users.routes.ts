import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./users.controller.js";
import { idParamSchema, listQuerySchema, updateUserSchema } from "./users.schema.js";

export const usersRouter = Router();

usersRouter.use(requireAuth());

usersRouter.get("/", validate({ query: listQuerySchema }), asyncHandler(controller.list));
usersRouter.get("/:id", validate({ params: idParamSchema }), asyncHandler(controller.getById));
usersRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateUserSchema }),
  asyncHandler(controller.update),
);
