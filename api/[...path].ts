/**
 * Vercel serverless entrypoint.
 *
 * Vercel routes every `/api/*` request to this catch-all function. We hand the
 * request to the SAME portable Express app used for self-hosting — an Express
 * app is itself a `(req, res)` handler, which is exactly what Vercel's Node
 * runtime expects as a default export.
 *
 * Self-hosting later (Railway / Fly / a VM / Docker) uses `server/index.ts`
 * instead (which calls `app.listen()`). The app core in `server/app.ts` knows
 * nothing about either target — that's what keeps the backend portable.
 */
import { createApp } from "../server/app.js";

export default createApp();

// Node.js runtime (not Edge) — required for Prisma and full Node APIs.
export const config = {
  runtime: "nodejs",
};
