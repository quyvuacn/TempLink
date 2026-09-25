import { readFile } from "node:fs/promises";
import { join } from "node:path";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "202609250001_initial_schema.sql",
);
const migration = await readFile(migrationPath, "utf8");
const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  connect_timeout: 15,
  idle_timeout: 5,
});

try {
  await sql.unsafe(migration);
  console.log("Supabase schema and private documents bucket are ready.");
} finally {
  await sql.end({ timeout: 5 });
}
