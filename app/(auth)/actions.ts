"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signInWithPassword(formData: FormData) {
  const email = getString(formData, "email").trim();
  const password = getString(formData, "password");
  const redirectTo = getString(formData, "redirectTo") || "/dashboard";
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
}

export async function signUpWithPassword(formData: FormData) {
  const email = getString(formData, "email").trim();
  const password = getString(formData, "password");
  const fullName = getString(formData, "fullName").trim();
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
