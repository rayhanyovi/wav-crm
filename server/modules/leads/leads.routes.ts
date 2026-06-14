import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./leads.controller.js";
import {
  addNoteSchema,
  claimForCallSchema,
  convertLeadSchema,
  createLeadSchema,
  idParamSchema,
  listQuerySchema,
  updateLeadSchema,
} from "./leads.schema.js";

/**
 * /api/leads — the reference module. Every other module (deals, contacts,
 * activities, …) should follow this exact shape: routes → validate → controller
 * → service (authz + transaction + side-effects). See docs/05-TODOS.md.
 */
export const leadsRouter = Router();

leadsRouter.use(requireAuth());

leadsRouter.get("/", validate({ query: listQuerySchema }), asyncHandler(controller.list));

leadsRouter.post("/", validate({ body: createLeadSchema }), asyncHandler(controller.create));

leadsRouter.get("/:id", validate({ params: idParamSchema }), asyncHandler(controller.getById));

leadsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateLeadSchema }),
  asyncHandler(controller.update),
);

leadsRouter.delete("/:id", validate({ params: idParamSchema }), asyncHandler(controller.remove));

// ── Phase 2 routes ────────────────────────────────────────────────────────
// claim-for-call must come before /:id routes to avoid param capture.
leadsRouter.post(
  "/claim-for-call",
  validate({ body: claimForCallSchema }),
  asyncHandler(controller.claimForCall),
);

leadsRouter.post("/:id/claim", validate({ params: idParamSchema }), asyncHandler(controller.claim));

leadsRouter.post(
  "/:id/return",
  validate({ params: idParamSchema }),
  asyncHandler(controller.returnLead),
);

leadsRouter.post(
  "/:id/convert",
  validate({ params: idParamSchema, body: convertLeadSchema }),
  asyncHandler(controller.convert),
);

leadsRouter.get(
  "/:id/notes",
  validate({ params: idParamSchema }),
  asyncHandler(controller.getNotes),
);

leadsRouter.post(
  "/:id/notes",
  validate({ params: idParamSchema, body: addNoteSchema }),
  asyncHandler(controller.addNote),
);

leadsRouter.get(
  "/:id/status-history",
  validate({ params: idParamSchema }),
  asyncHandler(controller.getStatusHistory),
);
