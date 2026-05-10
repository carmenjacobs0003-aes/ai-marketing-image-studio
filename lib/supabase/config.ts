import { env } from "@/lib/env";

export function hasSupabaseConfig() {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function requireSupabaseConfig() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  };
}

export function requireSupabaseAdminConfig() {
  const { url } = requireSupabaseConfig();

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin is not configured. Set SUPABASE_SERVICE_ROLE_KEY.");
  }

  return {
    url,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}
