import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./deals.controller.js";
import {
  addProposalLineSchema,
  createDealSchema,
  createProposalSchema,
  idParamSchema,
  lineParamSchema,
  listQuerySchema,
  proposalParamSchema,
  stageTransitionSchema,
  updateDealSchema,
  updateProposalSchema,
} from "./deals.schema.js";

export const dealsRouter = Router();

dealsRouter.use(requireAuth());

// ── CRUD ──────────────────────────────────────────────────────────────────────

dealsRouter.get("/", validate({ query: listQuerySchema }), asyncHandler(controller.list));

dealsRouter.post("/", validate({ body: createDealSchema }), asyncHandler(controller.create));

dealsRouter.get("/:id", validate({ params: idParamSchema }), asyncHandler(controller.getById));

dealsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateDealSchema }),
  asyncHandler(controller.update),
);

dealsRouter.delete("/:id", validate({ params: idParamSchema }), asyncHandler(controller.remove));

// ── Stage + ownership ─────────────────────────────────────────────────────────

dealsRouter.post(
  "/:id/stage",
  validate({ params: idParamSchema, body: stageTransitionSchema }),
  asyncHandler(controller.stage),
);

dealsRouter.post("/:id/claim", validate({ params: idParamSchema }), asyncHandler(controller.claim));

dealsRouter.post(
  "/:id/release",
  validate({ params: idParamSchema }),
  asyncHandler(controller.release),
);

// ── Stage history ─────────────────────────────────────────────────────────────

dealsRouter.get(
  "/:id/stage-history",
  validate({ params: idParamSchema }),
  asyncHandler(controller.getStageHistory),
);

// ── Proposals ─────────────────────────────────────────────────────────────────

dealsRouter.get(
  "/:id/proposals",
  validate({ params: idParamSchema }),
  asyncHandler(controller.getProposals),
);

dealsRouter.post(
  "/:id/proposals",
  validate({ params: idParamSchema, body: createProposalSchema }),
  asyncHandler(controller.createProposal),
);

dealsRouter.patch(
  "/:id/proposals/:proposalId",
  validate({ params: proposalParamSchema, body: updateProposalSchema }),
  asyncHandler(controller.updateProposal),
);

// ── Proposal lines ────────────────────────────────────────────────────────────

dealsRouter.post(
  "/:id/proposals/:proposalId/lines",
  validate({ params: proposalParamSchema, body: addProposalLineSchema }),
  asyncHandler(controller.addProposalLine),
);

dealsRouter.delete(
  "/:id/proposals/:proposalId/lines/:lineId",
  validate({ params: lineParamSchema }),
  asyncHandler(controller.removeProposalLine),
);
