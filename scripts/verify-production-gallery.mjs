import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function logPass(message) {
  console.log(`✅ ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(label, operation, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      console.log(
        `⏳ ${label} not ready yet; retrying (${attempt}/${attempts})`
      );
      await sleep(2000);
    }
  }
  throw lastError;
}

function readMigrations() {
  const migrationDir = join(process.cwd(), "supabase", "migrations");
  return readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      file,
      sql: readFileSync(join(migrationDir, file), "utf8")
    }));
}

function verifyLocalMigrations() {
  const migrations = readMigrations();
  const combinedSql = migrations.map((migration) => migration.sql).join("\n");

  for (const table of [
    "gallery_items",
    "gallery_favorites",
    "gallery_reports"
  ]) {
    assert(
      combinedSql.includes(`public.${table}`),
      `Local migrations do not include public.${table}`
    );
  }

  assert(
    combinedSql.includes("notify pgrst, 'reload schema'"),
    "Local migrations do not explicitly reload the PostgREST schema cache"
  );

  logPass(
    "Local migrations include gallery_items, gallery_favorites, gallery_reports, and PostgREST schema reload"
  );
}

function getEnv(name) {
  const value = process.env[name];
  assert(value, `Missing required environment variable: ${name}`);
  return value;
}

async function verifySchemaRpc(supabase) {
  return retry("PostgREST RPC schema cache", async () => {
    const { data, error } = await supabase.rpc("verify_gallery_schema_repair");

    assert(
      !error,
      `verify_gallery_schema_repair RPC failed: ${error?.message ?? "unknown error"}`
    );
    assert(
      data?.ok === true,
      `Gallery schema verification failed: ${JSON.stringify(data?.failed_checks ?? data)}`
    );

    logPass(
      "Production database reports gallery tables, RLS, policies, indexes, and SQL gallery queries are repaired"
    );
    return data;
  });
}

async function verifyPostgrestCache(supabaseUrl, anonKey) {
  await retry("PostgREST table schema cache", async () => {
    const url = new URL("/rest/v1/gallery_items", supabaseUrl);
    url.searchParams.set("select", "id,visibility,published_at");
    url.searchParams.set("visibility", "eq.public");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`
      }
    });
    const body = await response.text();

    assert(
      response.ok,
      `PostgREST gallery_items query failed (${response.status}): ${body}`
    );
    assert(
      !/schema cache|Could not find the table|public\.gallery_items/i.test(
        body
      ),
      `PostgREST schema cache still cannot see public.gallery_items: ${body}`
    );
  });

  logPass("PostgREST schema cache serves public.gallery_items successfully");
}

async function verifyLiveGalleryRoute() {
  const appUrl =
    process.env.PRODUCTION_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  assert(
    appUrl,
    "Missing PRODUCTION_APP_URL or NEXT_PUBLIC_APP_URL for live /gallery verification"
  );

  const url = new URL("/gallery", appUrl);
  const response = await fetch(url, { redirect: "follow" });
  const body = await response.text();

  assert(
    response.status < 500,
    `Live /gallery returned HTTP ${response.status}`
  );
  assert(
    !/schema cache|Could not find the table|public\.gallery_items/i.test(body),
    "Live /gallery still renders a gallery_items schema cache error"
  );

  logPass(
    `Live production route renders without gallery schema errors: ${url.toString()}`
  );
}

async function main() {
  verifyLocalMigrations();

  for (const name of requiredEnv) getEnv(name);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  await verifySchemaRpc(supabase);
  await verifyPostgrestCache(supabaseUrl, anonKey);
  await verifyLiveGalleryRoute();
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
