import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { prisma } from "../../lib/prisma.js";

export const healthRouter = Router();

/** Liveness — process is up. */
healthRouter.get(["/healthz", "/api/healthz"], (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

/** Readiness — DB reachable. */
healthRouter.get(
  ["/readyz", "/api/readyz"],
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  }),
);
