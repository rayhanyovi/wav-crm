import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";

const ROOT = process.cwd();
const ACTIVE_ENV = path.join(ROOT, ".env.local");
const PROFILES = {
  supabase: path.join(ROOT, ".env.local.supabase"),
  docker: path.join(ROOT, ".env.local.docker"),
};

const DOCKER_ENV = `# Local Docker development profile.
# Select with: npm run env:docker

APP_ENV=docker
NODE_ENV=development
PORT=4000
CORS_ORIGINS=http://localhost:5173

VITE_API_URL=http://localhost:4000
VITE_DEV_AUTH_ENABLED=true
DEV_AUTH_ENABLED=true

DATABASE_URL=postgresql://postgres:postgres@localhost:55432/wav_crm
DIRECT_URL=postgresql://postgres:postgres@localhost:55432/wav_crm

# Present only so shared Supabase client/bootstrap code can initialise.
# Docker dev uses DEV_AUTH_ENABLED instead of Supabase Auth.
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=local-dev-placeholder
SUPABASE_JWT_SECRET=local-dev-placeholder
SUPABASE_JWT_AUD=authenticated
`;

function usage() {
  console.log(`Usage:
  node scripts/select-env.mjs init
  node scripts/select-env.mjs docker
  node scripts/select-env.mjs supabase
  node scripts/select-env.mjs status

Profiles:
  .env.local.supabase  current/live Supabase profile
  .env.local.docker    local Docker Postgres + dev auth profile
`);
}

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function copyEnv(from, to) {
  if (!fs.existsSync(from)) throw new Error(`Missing profile: ${path.basename(from)}`);
  ensureParent(to);
  fs.copyFileSync(from, to);
}

function hash(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function initProfiles() {
  if (!fs.existsSync(PROFILES.supabase)) {
    if (!fs.existsSync(ACTIVE_ENV)) {
      throw new Error("Cannot create .env.local.supabase because .env.local does not exist");
    }
    copyEnv(ACTIVE_ENV, PROFILES.supabase);
    console.log("Created .env.local.supabase from current .env.local");
  } else {
    console.log(".env.local.supabase already exists");
  }

  if (!fs.existsSync(PROFILES.docker)) {
    fs.writeFileSync(PROFILES.docker, DOCKER_ENV, "utf8");
    console.log("Created .env.local.docker");
  } else {
    console.log(".env.local.docker already exists");
  }
}

function selectProfile(name) {
  const profile = PROFILES[name];
  if (!profile) throw new Error(`Unknown profile: ${name}`);
  copyEnv(profile, ACTIVE_ENV);
  console.log(`Selected ${name} profile -> .env.local`);
}

function status() {
  const active = hash(ACTIVE_ENV);
  if (!active) {
    console.log("No active .env.local");
    return;
  }

  const matched = Object.entries(PROFILES).find(([, file]) => hash(file) === active);
  console.log(matched ? `Active profile: ${matched[0]}` : "Active profile: custom .env.local");
}

try {
  const command = process.argv[2];
  if (!command || command === "--help" || command === "-h") {
    usage();
    process.exit(command ? 0 : 1);
  }

  if (command === "init") initProfiles();
  else if (command === "status") status();
  else if (command === "docker" || command === "supabase") selectProfile(command);
  else throw new Error(`Unknown command: ${command}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
