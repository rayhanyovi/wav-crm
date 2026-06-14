/**
 * Creates 3 demo accounts in Supabase Auth + crm_users.
 * Run with: npx tsx scripts/seed-demo.ts
 *
 * Requires in .env.local:
 *   SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_ACCOUNTS = [
  {
    email: "master@wav-demo.com",
    password: "Demo@1234!",
    name: "Demo Master",
    role: "MASTER" as const,
  },
  {
    email: "adviser@wav-demo.com",
    password: "Demo@1234!",
    name: "Demo Adviser",
    role: "ADVISER" as const,
  },
  {
    email: "telemarketer@wav-demo.com",
    password: "Demo@1234!",
    name: "Demo Telemarketer",
    role: "TELEMARKETER" as const,
  },
];

async function main() {
  console.log("Seeding demo accounts...\n");

  for (const account of DEMO_ACCOUNTS) {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true, // skip email verification
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        console.log(`⚠  ${account.email} already exists — skipping auth creation`);
        // Try to get existing user
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list?.users?.find((u) => u.email === account.email);
        if (existing) {
          await upsertCrmUser(existing.id, account.name, account.role);
        }
        continue;
      }
      console.error(`✗  Failed to create ${account.email}:`, authError.message);
      continue;
    }

    const userId = authData.user.id;
    await upsertCrmUser(userId, account.name, account.role);
    console.log(`✓  Created ${account.role}: ${account.email} (${userId})`);
  }

  console.log("\nDone! Login credentials:");
  console.log("─────────────────────────────────────────");
  for (const a of DEMO_ACCOUNTS) {
    console.log(`${a.role.padEnd(14)} ${a.email}  /  ${a.password}`);
  }
  console.log("─────────────────────────────────────────");
}

async function upsertCrmUser(id: string, name: string, role: "MASTER" | "ADVISER" | "TELEMARKETER") {
  const { error } = await supabase.from("crm_users").upsert(
    {
      id,
      name,
      email: DEMO_ACCOUNTS.find((a) => a.name === name)?.email ?? "",
      role,
      is_active: true,
      account_status: "ACTIVE",
      credit_balance: role === "TELEMARKETER" ? 0 : 10,
      telemarketer_access: role === "MASTER",
      leads_access: role !== "ADVISER",
    },
    { onConflict: "id" },
  );

  if (error) console.error(`  ✗ crm_users upsert failed for ${name}:`, error.message);
}

main().catch(console.error);
