import { requireUser } from "@/lib/auth/session";
import { listProjects } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/usage/limits";
import { StudioCanvas } from "@/components/studio/studio-canvas";

export default async function StudioPage() {
  const user = await requireUser("/studio");
  const supabase = createSupabaseServerClient();
  const [usage, projects] = await Promise.all([
    getUsageSummary(user.id),
    listProjects(supabase, user.id)
  ]);

  return <StudioCanvas projects={projects} usage={usage} />;
}
