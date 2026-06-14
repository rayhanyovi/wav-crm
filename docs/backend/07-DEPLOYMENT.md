# 07 — Deployment (single repo, Vercel)

The backend lives **inside `wav-crm-nextjs`** and deploys with the frontend as a
single Vercel project. The Vite frontend builds to static assets; the Express
backend runs as a serverless function. Same Git push deploys both.

## Repo layout

```
wav-crm-nextjs/
├── vercel.json              # buildCommand, output dir, function config, SPA rewrite
├── package.json             # ONE package — FE + BE deps/scripts merged
├── src/                     # Vite React frontend (unchanged)
├── server/                  # Backend core (portable Express app)
│   ├── app.ts               #   createApp() — knows nothing about Vercel
│   ├── index.ts             #   app.listen() — self-host entrypoint
│   ├── config/ lib/ middleware/ modules/
│   ├── tsconfig.json        #   server-only typecheck
│   └── tests/
├── api/
│   └── [...path].ts         # Vercel entrypoint: `export default createApp()`
├── prisma/
│   └── schema.prisma        # introspected from the live DB (prisma db pull)
└── vitest.server.config.ts  # server test runner (separate from frontend's)
```

## Two entrypoints, one app (this is the portability hinge)

| Target | Entry | How |
|--------|-------|-----|
| **Vercel** (now) | `api/[...path].ts` | Vercel routes `/api/*` to this function; it `export default createApp()`. An Express app *is* a `(req,res)` handler. |
| **Self-host later** (Railway/Fly/VM/Docker) | `server/index.ts` | `app.listen(PORT)`. Same `createApp()`. |

To move off Vercel: deploy `server/index.ts` to any Node host. Nothing in
`server/` changes. That's the whole point of keeping `createApp()` Vercel-blind.

## vercel.json

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": { "api/[...path].ts": { "maxDuration": 30 } },
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

- `/api/*` → the serverless function (Express). Everything else → the SPA.
- `npm run build` is `tsc -b && vite build` (frontend). `prisma generate` runs in
  `postinstall`, so the client exists before functions are bundled.

## Environment variables (Vercel dashboard → Settings → Environment)

| Var | Scope | Notes |
|-----|-------|-------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | client | Inlined into the browser bundle by Vite. |
| `DATABASE_URL` | **server only** | **Pooled** Supabase connection (pgBouncer, port 6543, `?pgbouncer=true`). |
| `DIRECT_URL` | server only | Direct connection — only for `prisma db pull`/migrations. |
| `SUPABASE_JWT_SECRET` | **server only** | Verifies the access token. |
| `CORS_ORIGINS` | server | Your deployed frontend origin(s). |

> ⚠️ **Never give backend secrets a `VITE_` prefix.** Vite inlines every
> `VITE_*` var into the client bundle — a `VITE_DATABASE_URL` would ship your DB
> credentials to every browser. Server vars stay unprefixed.

## Serverless gotchas (already handled in the scaffold)

1. **Prisma connections.** `server/lib/prisma.ts` caches the client on
   `globalThis` so warm invocations reuse one client. Use the **pooled**
   `DATABASE_URL` in prod or you'll exhaust Postgres under concurrency.
2. **No long-running work.** Serverless functions are request-scoped (≤
   `maxDuration`). Background jobs / cron / websockets need a separate worker
   (or the self-host entrypoint) — not this function.
3. **Cold starts.** First request after idle pays client init. Acceptable for a
   CRM; revisit with a warmer or self-host if it bites.
4. **CORS.** When FE and BE share an origin on Vercel you may not need CORS at
   all; keep it correct for local dev (`http://localhost:5173` → `:4000`).

## Local development

```bash
npm install            # also runs prisma generate (postinstall)
npm run dev            # frontend  (Vite, :5173)
npm run dev:server     # backend   (tsx watch, :4000)
npm run test:server    # backend tests
npm test               # frontend tests
npm run typecheck:server
```

Point the frontend's API client at `http://localhost:4000/api` in dev and at a
relative `/api` in prod (same origin on Vercel).
