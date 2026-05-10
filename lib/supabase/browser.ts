import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { requireSupabaseConfig } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = requireSupabaseConfig();

  return createBrowserClient<Database>(url, anonKey);
}
