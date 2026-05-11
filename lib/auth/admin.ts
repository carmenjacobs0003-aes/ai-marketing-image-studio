import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_UNAUTHENTICATED_ROUTE } from "@/lib/auth/routes";
import type { AdminProfile, AdminRole } from "@/lib/admin/types";

export function isPrivilegedRole(role?: string | null): role is Exclude<AdminRole, "user"> {
  return role === "admin" || role === "moderator";
}

export async function getCurrentAdmin(): Promise<{ user: User; profile: AdminProfile } | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const metadataRole = user.app_metadata?.role;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,plan,subscription_status,subscription_current_period_end,created_at,updated_at,admin_role,creator_verified,moderation_status,last_active_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const role = (data.admin_role ?? metadataRole) as AdminRole;
  if (!isPrivilegedRole(role) && metadataRole !== "admin") return null;

  return { user, profile: { ...data, admin_role: role } as AdminProfile };
}

export async function requireAdmin(): Promise<{ user: User; profile: AdminProfile }> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    const user = await getCurrentUser();
    if (!user) redirect(`${DEFAULT_UNAUTHENTICATED_ROUTE}?redirectTo=/admin`);
    notFound();
  }
  return admin;
}
