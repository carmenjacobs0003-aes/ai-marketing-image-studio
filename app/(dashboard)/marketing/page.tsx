import { MarketingGenerator } from "@/components/marketing/marketing-generator";
import { requireUser } from "@/lib/auth/session";
import { listBrandKits, listMarketingGenerations } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/usage/limits";

export default async function MarketingPage() {
  const user = await requireUser("/marketing");
  const supabase = createSupabaseServerClient();
  const [usage, generations, brandKits] = await Promise.all([
    getUsageSummary(user.id),
    listMarketingGenerations(supabase, user.id, 8),
    listBrandKits(supabase, user.id)
  ]);

  return (
    <MarketingGenerator
      brandKits={brandKits}
      generations={generations}
      usage={usage}
    />
  );
}
