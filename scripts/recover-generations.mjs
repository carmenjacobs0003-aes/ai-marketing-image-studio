import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cutoffMinutes = Number(process.env.RECOVERY_CUTOFF_MINUTES ?? 20);

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false }
});
const cutoff = new Date(Date.now() - cutoffMinutes * 60_000).toISOString();
const updates = {
  status: "failed",
  error_message: `Recovered stale job after ${cutoffMinutes} minutes. Please retry.`,
  updated_at: new Date().toISOString()
};

for (const table of ["image_generations", "marketing_generations"]) {
  const { error, count } = await supabase
    .from(table)
    .update(updates, { count: "exact" })
    .in("status", ["queued", "processing"])
    .lt("updated_at", cutoff);

  if (error) {
    console.error(`[recovery] ${table} failed`, error.message);
    process.exitCode = 1;
  } else {
    console.log(`[recovery] ${table}: ${count ?? 0} stale jobs recovered`);
  }
}
