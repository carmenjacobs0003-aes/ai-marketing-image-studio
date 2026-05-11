export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Logout error:", error);
  }

  redirect("/login?message=You%20have%20been%20logged%20out.");
}
