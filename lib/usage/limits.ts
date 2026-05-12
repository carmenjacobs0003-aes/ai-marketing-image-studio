import type { AppPlan, DailyUsageKind } from "@/lib/db/types";
import {
  getDailyUsage,
  getProfile,
  incrementDailyUsage
} from "@/lib/db/queries";
import { toIsoDate } from "@/lib/db/helpers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type UsageLimit = number | null;

export type UsageSummary = {
  plan: AppPlan;
  usageDate: string;
  marketingGenerations: number;
  marketingGenerationLimit: UsageLimit;
  remainingMarketingGenerations: UsageLimit;
  imageGenerations: number;
  imageGenerationLimit: UsageLimit;
  remainingImageGenerations: UsageLimit;
};

export type UsageEntitlement =
  | { allowed: true; usage: UsageSummary }
  | { allowed: false; usage: UsageSummary; reason: string };

const DAILY_LIMITS: Record<
  AppPlan,
  { marketingGenerations: UsageLimit; imageGenerations: UsageLimit }
> = {
  free: {
    marketingGenerations: 5,
    imageGenerations: 3
  },
  pro: {
    marketingGenerations: 50,
    imageGenerations: 50
  },
  agency: {
    marketingGenerations: null,
    imageGenerations: null
  }
};

function remaining(limit: UsageLimit, used: number): UsageLimit {
  return limit === null ? null : Math.max(limit - used, 0);
}

function usageValue(summary: UsageSummary, kind: DailyUsageKind) {
  return kind === "marketing_generations"
    ? summary.marketingGenerations
    : summary.imageGenerations;
}

function usageLimit(summary: UsageSummary, kind: DailyUsageKind) {
  return kind === "marketing_generations"
    ? summary.marketingGenerationLimit
    : summary.imageGenerationLimit;
}

export function getPlanDailyLimits(plan: AppPlan) {
  return DAILY_LIMITS[plan];
}

export async function getUsageSummary(
  userId: string,
  date = new Date()
): Promise<UsageSummary> {
  const supabase = createSupabaseServerClient();
  const usageDate = toIsoDate(date);
  const [profile, usage] = await Promise.all([
    getProfile(supabase, userId),
    getDailyUsage(supabase, userId, usageDate)
  ]);
  const plan = profile?.plan ?? "free";
  const limits = getPlanDailyLimits(plan);
  const marketingGenerations = usage?.marketing_generations ?? 0;
  const imageGenerations = usage?.image_generations ?? 0;

  return {
    plan,
    usageDate,
    marketingGenerations,
    marketingGenerationLimit: limits.marketingGenerations,
    remainingMarketingGenerations: remaining(
      limits.marketingGenerations,
      marketingGenerations
    ),
    imageGenerations,
    imageGenerationLimit: limits.imageGenerations,
    remainingImageGenerations: remaining(
      limits.imageGenerations,
      imageGenerations
    )
  };
}

export async function assertCanUse(
  userId: string,
  kind: DailyUsageKind
): Promise<UsageEntitlement> {
  const usage = await getUsageSummary(userId);
  const limit = usageLimit(usage, kind);

  if (limit !== null && usageValue(usage, kind) >= limit) {
    return {
      allowed: false,
      usage,
      reason: "AI generation limit reached"
    };
  }

  return { allowed: true, usage };
}

export function assertCanGenerateMarketing(userId: string) {
  return assertCanUse(userId, "marketing_generations");
}

export function assertCanGenerateImage(userId: string) {
  return assertCanUse(userId, "image_generations");
}

export async function recordSuccessfulUsage(
  userId: string,
  kind: DailyUsageKind,
  quantity = 1
) {
  const supabase = createSupabaseServerClient();

  return incrementDailyUsage(supabase, userId, kind, quantity);
}
