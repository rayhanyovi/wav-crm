import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireSession } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./users.controller.js";
import {
  approveUserSchema,
  idParamSchema,
  listQuerySchema,
  onboardingSchema,
  updateUserSchema,
} from "./users.schema.js";

export const usersRouter = Router();

// Onboarding/bootstrap routes only need a valid session (the crm_users row),
// not an ACTIVE, role-assigned account — that's the whole point of the flow.
// Declared before the `/:id` catch-all so they aren't shadowed.
usersRouter.post(
  "/onboarding",
  requireSession(),
  validate({ body: onboardingSchema }),
  asyncHandler(controller.onboarding),
);
usersRouter.post("/activate-super-admin", requireSession(), asyncHandler(controller.activateSuperAdmin));

// Everything else requires a fully active, role-assigned account.
usersRouter.use(requireAuth());

usersRouter.get("/", validate({ query: listQuerySchema }), asyncHandler(controller.list));
usersRouter.get("/pending", asyncHandler(controller.listPending));

usersRouter.get("/:id", validate({ params: idParamSchema }), asyncHandler(controller.getById));
usersRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateUserSchema }),
  asyncHandler(controller.update),
);
usersRouter.post(
  "/:id/approve",
  validate({ params: idParamSchema, body: approveUserSchema }),
  asyncHandler(controller.approve),
);
usersRouter.post("/:id/reject", validate({ params: idParamSchema }), asyncHandler(controller.reject));
