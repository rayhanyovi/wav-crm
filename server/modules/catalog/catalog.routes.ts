import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as controller from "./catalog.controller.js";
import { fundsQuerySchema, productsQuerySchema } from "./catalog.schema.js";

export const fundsRouter = Router();
export const productsRouter = Router();
export const bundlesRouter = Router();

fundsRouter.use(requireAuth());
productsRouter.use(requireAuth());
bundlesRouter.use(requireAuth());

fundsRouter.get("/meta", asyncHandler(controller.getFundsMeta));
fundsRouter.get("/", validate({ query: fundsQuerySchema }), asyncHandler(controller.listFunds));
productsRouter.get("/", validate({ query: productsQuerySchema }), asyncHandler(controller.listProducts));
bundlesRouter.get("/", validate({ query: productsQuerySchema }), asyncHandler(controller.listBundles));
