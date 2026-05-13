import { requireUser } from "@/lib/auth/session";
import { listBrandKits } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/usage/limits";
import { StudioCanvas } from "@/components/studio/studio-canvas";

export default async function StudioPage() {
  const user = await requireUser("/studio");
  const supabase = createSupabaseServerClient();
  const [usage, brandKits] = await Promise.all([
    getUsageSummary(user.id),
    listBrandKits(supabase, user.id)
  ]);

  return <StudioCanvas brandKits={brandKits} usage={usage} />;
}
