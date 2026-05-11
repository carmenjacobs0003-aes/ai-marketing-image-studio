import { UserPreferencesPanel } from "@/components/settings/user-preferences-panel";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const user = await requireUser("/settings");
  const profile = await getProfile(createSupabaseServerClient(), user.id);

  return (
    <main className="page-shell">
      <div className="page-container max-w-7xl">
        <UserPreferencesPanel
          email={user.email}
          fullName={profile?.full_name}
          plan={profile?.plan ?? "free"}
        />
      </div>
    </main>
  );
}
