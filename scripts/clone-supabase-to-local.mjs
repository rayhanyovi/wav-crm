import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

const ROOT = process.cwd();
const COMPOSE_FILE = path.join(ROOT, "docker-compose.local.yml");
const SNAPSHOT_DIR = path.join(ROOT, ".local-data", "snapshots");
const POSTGRES_IMAGE = process.env.LOCAL_POSTGRES_IMAGE || "postgres:17-alpine";

const SOURCE_ENV = path.join(ROOT, ".env.local.supabase");
const TARGET_ENV = path.join(ROOT, ".env.local.docker");

function usage() {
  console.log(`Usage:
  npm run db:local:clone

What it does:
  1. Starts local Docker Postgres from docker-compose.local.yml
  2. Dumps the public schema/data from .env.local.supabase
  3. Recreates the local wav_crm database from .env.local.docker
  4. Restores the dump into local Docker Postgres

Generated snapshots are written to .local-data/snapshots/ and are ignored by git.
`);
}

function run(label, command, args, options = {}) {
  console.log(`\n${label}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }
}

function readEnv(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${path.basename(file)}. Run npm run env:init first.`);
  return dotenv.parse(fs.readFileSync(file));
}

function connectionUrl(env, label) {
  const url = env.DIRECT_URL || env.DATABASE_URL;
  if (!url) throw new Error(`${label} needs DIRECT_URL or DATABASE_URL`);
  return url.replace(/^"|"$/g, "");
}

function dbName(rawUrl) {
  const url = new URL(rawUrl);
  const name = url.pathname.replace(/^\//, "");
  if (!name) throw new Error(`Cannot determine database name from ${url.hostname}`);
  return name;
}

function parsePgEnv(rawUrl) {
  const url = new URL(rawUrl);
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.replace(/^\//, ""),
    PGSSLMODE: url.searchParams.get("sslmode") || (url.hostname.includes("supabase") ? "require" : "prefer"),
  };
}

function localDockerPgEnv(rawUrl) {
  const env = parsePgEnv(rawUrl);
  const url = new URL(rawUrl);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    env.PGHOST = "host.docker.internal";
  }
  return env;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function dockerRunPostgres(args, pgEnv = {}) {
  const envArgs = Object.entries(pgEnv).flatMap(([key, value]) => ["-e", `${key}=${value}`]);
  run("Running Postgres client container", "docker", [
    "run",
    "--rm",
    "--add-host",
    "host.docker.internal:host-gateway",
    "-v",
    `${SNAPSHOT_DIR}:/snapshots`,
    ...envArgs,
    POSTGRES_IMAGE,
    ...args,
  ]);
}

function waitForDb(db) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const result = spawnSync(
      "docker",
      ["compose", "-f", COMPOSE_FILE, "exec", "-T", "db", "pg_isready", "-U", "postgres", "-d", db],
      { cwd: ROOT, stdio: "ignore" },
    );
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error("Local Docker Postgres did not become ready in time");
}

function prepareLocalSupabaseCompat(localDb) {
  const sql = `
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select null::text $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;
`;
  run("Preparing local Supabase compatibility roles", "docker", [
    "compose",
    "-f",
    COMPOSE_FILE,
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "postgres",
    "-d",
    localDb,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ]);
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    return;
  }

  const source = readEnv(SOURCE_ENV);
  const target = readEnv(TARGET_ENV);
  const sourceUrl = connectionUrl(source, ".env.local.supabase");
  const targetUrl = connectionUrl(target, ".env.local.docker");
  const localDb = dbName(targetUrl);

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const dumpName = `supabase-public-${timestamp()}.dump`;
  const dumpPath = `/snapshots/${dumpName}`;

  run("Starting local Docker Postgres", "docker", ["compose", "-f", COMPOSE_FILE, "up", "-d", "db"]);
  waitForDb(localDb);

  dockerRunPostgres([
    "pg_dump",
    "--schema",
    "public",
    "--format",
    "custom",
    "--no-owner",
    "--no-privileges",
    "--file",
    dumpPath,
  ], parsePgEnv(sourceUrl));

  run("Dropping local database", "docker", [
    "compose",
    "-f",
    COMPOSE_FILE,
    "exec",
    "-T",
    "db",
    "dropdb",
    "-U",
    "postgres",
    "--if-exists",
    localDb,
  ]);
  run("Creating local database", "docker", [
    "compose",
    "-f",
    COMPOSE_FILE,
    "exec",
    "-T",
    "db",
    "createdb",
    "-U",
    "postgres",
    localDb,
  ]);
  prepareLocalSupabaseCompat(localDb);

  dockerRunPostgres([
    "pg_restore",
    "--dbname",
    localDb,
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    dumpPath,
  ], localDockerPgEnv(targetUrl));

  run("Checking cloned CRM users", "docker", [
    "compose",
    "-f",
    COMPOSE_FILE,
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "postgres",
    "-d",
    localDb,
    "-c",
    "select role, count(*) from public.crm_users where is_active and account_status = 'ACTIVE' group by role order by role;",
  ]);

  console.log(`\nLocal clone complete. Snapshot: .local-data/snapshots/${dumpName}`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
