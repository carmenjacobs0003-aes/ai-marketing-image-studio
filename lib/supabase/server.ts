import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { requireSupabaseConfig } from "@/lib/supabase/config";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  const { url, anonKey } = requireSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options) {
        cookieStore.set({ name, value: "", ...options });
      }
    }
  });
}
