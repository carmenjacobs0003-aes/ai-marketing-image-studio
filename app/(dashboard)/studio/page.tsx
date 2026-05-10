import { requireUser } from "@/lib/auth/session";
import { listBrandKits, listProjects } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/usage/limits";
import { StudioCanvas } from "@/components/studio/studio-canvas";

export default async function StudioPage() {
  const user = await requireUser("/studio");
  const supabase = createSupabaseServerClient();
  const [usage, projects, brandKits] = await Promise.all([
    getUsageSummary(user.id),
    listProjects(supabase, user.id),
    listBrandKits(supabase, user.id)
  ]);

  return (
    <StudioCanvas brandKits={brandKits} projects={projects} usage={usage} />
  );
}
