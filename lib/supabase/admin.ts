import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { requireSupabaseAdminConfig } from "@/lib/supabase/config";

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = requireSupabaseAdminConfig();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
