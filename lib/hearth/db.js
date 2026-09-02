// The Hearth's database: Neon Postgres over HTTP.
//
// One connection string, Vercel-managed (DATABASE_URL, set by the Neon
// marketplace integration). Nothing in this repo ever holds it. Every query
// goes through the tagged template `sql`, which parameterizes values, so a
// string from a visitor can never become SQL.
//
// Migrations are SQL strings in migrations.js and apply themselves: on a cold
// start the first request runs `ready()`, which reads what has been applied
// and applies the rest, each in its own transaction. Every statement is
// written to be idempotent, so two instances racing on a cold start cannot
// hurt each other.

import { neon } from "@neondatabase/serverless";
import { MIGRATIONS } from "./migrations.js";

let client = null;
let readyPromise = null;

export function databaseUrl(env = process.env) {
  const url = typeof env.DATABASE_URL === "string" ? env.DATABASE_URL.trim() : "";
  return url;
}

export function configured(env = process.env) {
  return Boolean(databaseUrl(env));
}

// The tagged-template client. `sql\`select ... ${value}\`` parameterizes;
// `sql.query(text, params)` runs a plain string with positional params.
export function sql() {
  if (client) return client;
  const url = databaseUrl();
  if (!url) throw new Error("DatabaseUnconfigured");
  client = neon(url, { fullResults: false });
  return client;
}

// For tests: hand in a fake client and skip migrations.
export function useClient(fake) {
  client = fake;
  readyPromise = Promise.resolve();
}

export async function migrate(db = sql()) {
  await db.query(
    "create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())"
  );
  const rows = await db.query("select id from schema_migrations");
  const applied = new Set(rows.map((row) => row.id));
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    const statements = migration.statements.map((text) => db.query(text));
    statements.push(
      db.query("insert into schema_migrations (id) values ($1) on conflict do nothing", [migration.id])
    );
    await db.transaction(statements);
  }
}

// Resolves once the schema is current. Cached per instance; a failure clears
// the cache so the next request tries again instead of staying broken.
export function ready() {
  if (!readyPromise) {
    readyPromise = migrate().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

// Neon's transaction takes an array of prepared queries; this is the same
// shape for the few places that need several writes to land together.
export async function transaction(queries) {
  return await sql().transaction(queries);
}
