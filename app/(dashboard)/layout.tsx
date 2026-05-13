import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { getUsageSummary } from "@/lib/usage/limits";
import { isPrivilegedRole } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();
  const [usage, profileResult] = await Promise.all([
    getUsageSummary(user.id),
    supabase
      .from("profiles")
      .select("admin_role")
      .eq("id", user.id)
      .maybeSingle()
  ]);
  const profile = profileResult.data as { admin_role?: string | null } | null;
  const showAdminNav = isPrivilegedRole(profile?.admin_role);

  return (
    <AppShell showAdminNav={showAdminNav} usage={usage} user={user}>
      {children}
    </AppShell>
  );
}
