import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

const schemaCachePatterns =
  /schema cache|Could not find the table|Could not find the 'project_id' column|public\.projects|public\.image_generations|public\.marketing_generations/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function logPass(message) {
  console.log(`✅ ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(label, operation, attempts = 8) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      console.log(`⏳ ${label} not ready yet; retrying (${attempt}/${attempts})`);
      await sleep(2000);
    }
  }
  throw lastError;
}

function getEnv(name) {
  const value = process.env[name];
  assert(value, `Missing required environment variable: ${name}`);
  return value;
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
  const combinedSql = readMigrations()
    .map((migration) => `-- ${migration.file}\n${migration.sql}`)
    .join("\n");

  for (const snippet of [
    "create table if not exists public.projects",
    "add column if not exists brand_kit_id uuid",
    "alter table public.image_generations",
    "add column if not exists project_id uuid",
    "alter table public.marketing_generations",
    "foreign key (project_id)",
    "create index if not exists image_generations_project_id_idx",
    "create index if not exists marketing_generations_project_id_idx",
    "notify pgrst, 'reload schema'",
    "verify_projects_schema_repair"
  ]) {
    assert(
      combinedSql.includes(snippet),
      `Local migrations do not include required snippet: ${snippet}`
    );
  }

  logPass(
    "Local migrations include the /projects schema repair, foreign keys, indexes, and PostgREST schema reload"
  );
}

async function verifySchemaRpc(supabase) {
  return retry("PostgREST RPC schema cache", async () => {
    const { data, error } = await supabase.rpc("verify_projects_schema_repair");

    assert(
      !error,
      `verify_projects_schema_repair RPC failed: ${error?.message ?? "unknown error"}`
    );
    assert(
      data?.ok === true,
      `Projects schema verification failed: ${JSON.stringify(data?.failed_checks ?? data)}`
    );

    logPass(
      "Production database reports /projects tables, columns, foreign keys, and indexes are repaired"
    );
    return data;
  });
}

async function verifyRestQuery({ supabaseUrl, serviceRoleKey, path, params, label }) {
  await retry(label, async () => {
    const url = new URL(`/rest/v1/${path}`, supabaseUrl);
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }

    const response = await fetch(url, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`
      }
    });
    const body = await response.text();

    assert(response.ok, `${label} failed (${response.status}): ${body}`);
    assert(!schemaCachePatterns.test(body), `${label} still has schema cache drift: ${body}`);
  });

  logPass(`${label} executes through PostgREST`);
}

async function verifyPostgrestCache(supabaseUrl, serviceRoleKey) {
  const userId =
    process.env.PRODUCTION_TEST_USER_ID ?? "00000000-0000-0000-0000-000000000000";

  await verifyRestQuery({
    supabaseUrl,
    serviceRoleKey,
    path: "projects",
    label: "listProjects query",
    params: {
      select: "*",
      user_id: `eq.${userId}`,
      order: "created_at.desc",
      limit: "1"
    }
  });

  await verifyRestQuery({
    supabaseUrl,
    serviceRoleKey,
    path: "brand_kits",
    label: "listBrandKits query",
    params: {
      select: "*",
      user_id: `eq.${userId}`,
      order: "created_at.desc",
      limit: "1"
    }
  });

  await verifyRestQuery({
    supabaseUrl,
    serviceRoleKey,
    path: "marketing_generations",
    label: "listProjectMarketingGenerations query",
    params: {
      select: "*",
      user_id: `eq.${userId}`,
      project_id: "not.is.null",
      order: "created_at.desc",
      limit: "1"
    }
  });

  await verifyRestQuery({
    supabaseUrl,
    serviceRoleKey,
    path: "image_generations",
    label: "listProjectImageGenerations query",
    params: {
      select: "*",
      user_id: `eq.${userId}`,
      project_id: "not.is.null",
      order: "created_at.desc",
      limit: "1"
    }
  });
}

async function verifySupabaseClientQueries(supabase) {
  const userId =
    process.env.PRODUCTION_TEST_USER_ID ?? "00000000-0000-0000-0000-000000000000";

  const queries = [
    {
      label: "listProjects",
      run: () =>
        supabase
          .from("projects")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
    },
    {
      label: "listBrandKits",
      run: () =>
        supabase
          .from("brand_kits")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
    },
    {
      label: "listProjectMarketingGenerations",
      run: () =>
        supabase
          .from("marketing_generations")
          .select("*")
          .eq("user_id", userId)
          .not("project_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
    },
    {
      label: "listProjectImageGenerations",
      run: () =>
        supabase
          .from("image_generations")
          .select("*")
          .eq("user_id", userId)
          .not("project_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
    }
  ];

  for (const query of queries) {
    const { error } = await query.run();
    assert(!error, `${query.label} failed: ${error?.message ?? "unknown error"}`);
    logPass(`${query.label} Supabase client query executes successfully`);
  }
}

async function verifyLiveProjectsRoute() {
  const appUrl = process.env.PRODUCTION_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  assert(
    appUrl,
    "Missing PRODUCTION_APP_URL or NEXT_PUBLIC_APP_URL for live /projects verification"
  );

  const url = new URL("/projects", appUrl);
  const headers = {};
  if (process.env.PRODUCTION_AUTH_COOKIE) {
    headers.cookie = process.env.PRODUCTION_AUTH_COOKIE;
  }

  const response = await fetch(url, { headers, redirect: "follow" });
  const body = await response.text();

  assert(response.status < 500, `Live /projects returned HTTP ${response.status}`);
  assert(!schemaCachePatterns.test(body), "Live /projects still renders a projects schema error");

  logPass(`Live production route responds without /projects schema errors: ${url.toString()}`);
}

async function main() {
  verifyLocalMigrations();

  for (const name of requiredEnv) getEnv(name);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  await verifySchemaRpc(supabase);
  await verifyPostgrestCache(supabaseUrl, serviceRoleKey);
  await verifySupabaseClientQueries(supabase);
  await verifyLiveProjectsRoute();
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
