import type { AppPlan } from "@/lib/db/types";
import {
  getMonthlyUsage,
  getProfile,
  incrementMonthlyUsage
} from "@/lib/db/queries";
import { getBillingPlan } from "@/lib/billing/plans";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type UsageLimit = number;

export type UsageSummary = {
  plan: AppPlan;
  usageMonth: string;
  totalGenerations: number;
  monthlyGenerationLimit: UsageLimit;
  remainingGenerations: UsageLimit;
  includedMarketingGenerations: number;
  includedImageGenerations: number;
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

export function toUsageMonth(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}-01`;
}

function remaining(limit: UsageLimit, used: number): UsageLimit {
  return Math.max(limit - used, 0);
}

export function getPlanMonthlyLimit(plan: AppPlan) {
  return getBillingPlan(plan).monthlyPooledGenerations;
}

export async function getUsageSummary(
  userId: string,
  date = new Date()
): Promise<UsageSummary> {
  const supabase = createSupabaseServerClient();
  const usageMonth = toUsageMonth(date);
  const [profile, usage] = await Promise.all([
    getProfile(supabase, userId),
    getMonthlyUsage(supabase, userId, usageMonth)
  ]);
  const plan = profile?.plan ?? "free";
  const billingPlan = getBillingPlan(plan);
  const totalGenerations = usage?.total_generations ?? 0;
  const monthlyGenerationLimit = billingPlan.monthlyPooledGenerations;

  return {
    plan,
    usageMonth,
    totalGenerations,
    monthlyGenerationLimit,
    remainingGenerations: remaining(monthlyGenerationLimit, totalGenerations),
    includedMarketingGenerations: billingPlan.monthlyMarketingGenerations,
    includedImageGenerations: billingPlan.monthlyImageGenerations,
    marketingGenerations: totalGenerations,
    marketingGenerationLimit: monthlyGenerationLimit,
    remainingMarketingGenerations: remaining(
      monthlyGenerationLimit,
      totalGenerations
    ),
    imageGenerations: totalGenerations,
    imageGenerationLimit: monthlyGenerationLimit,
    remainingImageGenerations: remaining(
      monthlyGenerationLimit,
      totalGenerations
    )
  };
}

export async function assertCanUse(userId: string): Promise<UsageEntitlement> {
  const usage = await getUsageSummary(userId);

  if (usage.totalGenerations >= usage.monthlyGenerationLimit) {
    return {
      allowed: false,
      usage,
      reason: `Monthly generation limit reached. Your plan includes ${usage.monthlyGenerationLimit} total generations each month across images and marketing. Use them in any combination.`
    };
  }

  return { allowed: true, usage };
}

export function assertCanGenerateMarketing(userId: string) {
  return assertCanUse(userId);
}

export function assertCanGenerateImage(userId: string) {
  return assertCanUse(userId);
}

export async function recordSuccessfulUsage(userId: string, quantity = 1) {
  const supabase = createSupabaseServerClient();

  return incrementMonthlyUsage(supabase, userId, quantity);
}
