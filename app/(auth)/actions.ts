"use server";

import { redirect } from "next/navigation";
import { getSafeRedirectPath } from "@/lib/auth/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWithMessage(pathname: string, type: "error" | "message", message: string, redirectTo?: string) {
  const params = new URLSearchParams({ [type]: message });

  if (redirectTo) {
    params.set("redirectTo", redirectTo);
  }

  redirect(`${pathname}?${params.toString()}`);
}

export async function signInWithPassword(formData: FormData) {
  const email = getString(formData, "email").trim().toLowerCase();
  const password = getString(formData, "password");
  const redirectTo = getSafeRedirectPath(getString(formData, "redirectTo"));

  if (!email || !password) {
    redirectWithMessage("/login", "error", "Enter your email and password to continue.", redirectTo);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirectWithMessage("/login", "error", error.message, redirectTo);
  }

  redirect(redirectTo);
}

export async function signUpWithPassword(formData: FormData) {
  const email = getString(formData, "email").trim().toLowerCase();
  const password = getString(formData, "password");
  const fullName = getString(formData, "fullName").trim();
  const redirectTo = getSafeRedirectPath(getString(formData, "redirectTo"));

  if (!fullName || !email || !password) {
    redirectWithMessage("/signup", "error", "Name, email, and password are required.", redirectTo);
  }

  if (password.length < 8) {
    redirectWithMessage("/signup", "error", "Password must be at least 8 characters.", redirectTo);
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    redirectWithMessage("/signup", "error", error.message, redirectTo);
  }

  if (!data.session) {
    redirectWithMessage("/login", "message", "Check your email to confirm your account, then log in.", redirectTo);
  }

  redirect(redirectTo);
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login?message=You%20have%20been%20logged%20out.");
}
