import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { getUsageSummary } from "@/lib/usage/limits";

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const usage = await getUsageSummary(user.id);

  return (
    <AppShell usage={usage} user={user}>
      {children}
    </AppShell>
  );
}
