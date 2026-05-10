import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_UNAUTHENTICATED_ROUTE } from "@/lib/auth/routes";

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getCurrentSession() {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session) {
    return null;
  }

  return session;
}

export async function requireUser(redirectTo?: string): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    const loginPath = new URLSearchParams();

    if (redirectTo) {
      loginPath.set("redirectTo", redirectTo);
    }

    redirect(`${DEFAULT_UNAUTHENTICATED_ROUTE}${loginPath.size ? `?${loginPath.toString()}` : ""}`);
  }

  return user;
}
