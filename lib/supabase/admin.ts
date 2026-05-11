import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { requireSupabaseAdminConfig } from "@/lib/supabase/config";
import { fetchWithTimeout } from "@/lib/supabase/fetch";

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = requireSupabaseAdminConfig();

  return createClient<Database>(url, serviceRoleKey, {
    global: {
      fetch: fetchWithTimeout
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
