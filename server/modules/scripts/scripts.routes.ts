import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./scripts.controller.js";
import { createScriptSchema, idParamSchema, updateScriptSchema } from "./scripts.schema.js";

export const scriptsRouter = Router();

scriptsRouter.use(requireAuth());

scriptsRouter.get("/", asyncHandler(controller.list));

scriptsRouter.post(
  "/",
  validate({ body: createScriptSchema }),
  asyncHandler(controller.create),
);

scriptsRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(controller.getById),
);

scriptsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateScriptSchema }),
  asyncHandler(controller.update),
);

scriptsRouter.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(controller.remove),
);
