import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./contacts.controller.js";
import {
  addNoteSchema,
  createContactSchema,
  idParamSchema,
  listQuerySchema,
  updateContactSchema,
} from "./contacts.schema.js";

export const contactsRouter = Router();

contactsRouter.use(requireAuth());

contactsRouter.get("/", validate({ query: listQuerySchema }), asyncHandler(controller.list));
contactsRouter.post("/", validate({ body: createContactSchema }), asyncHandler(controller.create));
contactsRouter.get("/:id", validate({ params: idParamSchema }), asyncHandler(controller.getById));
contactsRouter.patch(
  "/:id",
  validate({ params: idParamSchema, body: updateContactSchema }),
  asyncHandler(controller.update),
);
contactsRouter.delete("/:id", validate({ params: idParamSchema }), asyncHandler(controller.remove));

contactsRouter.get("/:id/notes", validate({ params: idParamSchema }), asyncHandler(controller.getNotes));
contactsRouter.post(
  "/:id/notes",
  validate({ params: idParamSchema, body: addNoteSchema }),
  asyncHandler(controller.addNote),
);
