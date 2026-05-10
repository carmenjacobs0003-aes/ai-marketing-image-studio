import { MarketingGenerator } from "@/components/marketing/marketing-generator";
import { requireUser } from "@/lib/auth/session";
import {
  listBrandKits,
  listMarketingGenerations,
  listProjects
} from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/usage/limits";

export default async function MarketingPage() {
  const user = await requireUser("/marketing");
  const supabase = createSupabaseServerClient();
  const [usage, generations, projects, brandKits] = await Promise.all([
    getUsageSummary(user.id),
    listMarketingGenerations(supabase, user.id, 8),
    listProjects(supabase, user.id),
    listBrandKits(supabase, user.id)
  ]);

  return (
    <MarketingGenerator
      brandKits={brandKits}
      generations={generations}
      projects={projects}
      usage={usage}
    />
  );
}
