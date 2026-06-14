import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { PrismaClient } from "../prisma/generated/client/index.js";

const file = process.argv[2];
if (!file) {
  console.error("usage: tsx scripts/db-apply-migration.ts <path-to.sql>");
  process.exit(1);
}

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Split SQL into statements on `;`, but treat $$...$$ dollar-quoted bodies as opaque. */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    const two = sql.slice(i, i + 2);
    if (two === "$$") {
      inDollar = !inDollar;
      buf += two;
      i++;
      continue;
    }
    const ch = sql[i];
    if (ch === ";" && !inDollar) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  // Drop pure-comment statements.
  return out.filter((s) => s.split("\n").some((l) => l.trim() && !l.trim().startsWith("--")));
}

async function main() {
  const sql = readFileSync(file, "utf8");
  const statements = splitStatements(sql);
  for (const [i, stmt] of statements.entries()) {
    await prisma.$executeRawUnsafe(stmt);
    console.log(`  ✓ statement ${i + 1}/${statements.length}: ${stmt.split("\n").find((l) => l.trim() && !l.trim().startsWith("--"))?.trim().slice(0, 60)}`);
  }
  console.log(`Applied migration: ${file}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
