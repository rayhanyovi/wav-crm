# Local Docker Development

This repo supports two local env profiles:

- `.env.local.supabase` — live Supabase project
- `.env.local.docker` — local Docker Postgres + simple dev auth

Both files are ignored by git. `.env.local` is the active profile and is selected by script.

## First Setup

```bash
npm run env:init
npm run db:local:clone
npm run env:docker
npm run dev
```

`env:init` copies the current `.env.local` into `.env.local.supabase` and creates `.env.local.docker`.

`db:local:clone` starts Docker Postgres, dumps the live Supabase `public` schema/data through a temporary Postgres client container, resets local `wav_crm`, and restores the snapshot locally.

## Daily Use

Run against Docker:

```bash
npm run dev:docker
```

Run against Supabase:

```bash
npm run dev:supabase
```

Check the active profile:

```bash
npm run env:status
```

## Dev Auth

Docker mode sets:

```bash
DEV_AUTH_ENABLED=true
VITE_DEV_AUTH_ENABLED=true
```

The login page becomes a CRM user picker. API requests send `x-dev-user-id`, and the backend resolves that real `crm_users` row for role/permission checks. Supabase mode still uses normal Supabase Auth/JWTs.

## Reset Local DB

Drop the Docker volume:

```bash
npm run db:local:reset
```

Then re-clone:

```bash
npm run db:local:clone
```
