import type { Database } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Plan = Database["public"]["Enums"]["app_plan"];

type UsageSummary = {
  plan: Plan;
  imageGenerations: number;
  imageGenerationLimit: number;
  remainingImageGenerations: number;
};

const PLAN_IMAGE_LIMITS: Record<Plan, number> = {
  free: 25,
  pro: 500,
  team: 2500
};

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const supabase = createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", userId).maybeSingle();
  const { data: usageRows } = await supabase.from("usage_totals_current_month").select("event_type,total_quantity").eq("user_id", userId);
  const plan = profile?.plan ?? "free";
  const imageGenerations = usageRows?.find((row) => row.event_type === "image_generation")?.total_quantity ?? 0;
  const imageGenerationLimit = PLAN_IMAGE_LIMITS[plan];

  return {
    plan,
    imageGenerations,
    imageGenerationLimit,
    remainingImageGenerations: Math.max(imageGenerationLimit - imageGenerations, 0)
  };
}

export async function assertCanGenerateImage(userId: string) {
  const usage = await getUsageSummary(userId);

  if (usage.imageGenerations >= usage.imageGenerationLimit) {
    return { allowed: false as const, usage };
  }

  return { allowed: true as const, usage };
}

export async function recordUsageEvent(userId: string, metadata: Record<string, unknown> = {}) {
  const supabase = createSupabaseServerClient();

  await supabase.from("usage_events").insert({
    user_id: userId,
    event_type: "image_generation",
    quantity: 1,
    metadata
  });
}
