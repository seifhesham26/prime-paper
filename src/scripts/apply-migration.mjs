// Applies one .sql file to the database over the Neon HTTP driver.
// drizzle-kit migrate cannot be used here: __drizzle_migrations is empty
// while 0000 is already applied, so it would try to replay it and fail.
//
// Usage: node src/scripts/apply-migration.mjs drizzle/0003_production_automation.sql
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node src/scripts/apply-migration.mjs <path-to.sql>");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const statements = readFileSync(file, "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

for (const [i, statement] of statements.entries()) {
  console.log(`[${i + 1}/${statements.length}] ${statement.slice(0, 80)}...`);
  await sql.query(statement);
}

console.log(`Applied ${statements.length} statement(s) from ${file}`);
