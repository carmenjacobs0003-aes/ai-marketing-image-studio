import type { AppPlan, DailyUsageKind } from "@/lib/db/types";
import {
  getMonthlyUsage,
  getMonthlyUsageFromDailyTotals,
  getProfile,
  incrementDailyUsage,
  incrementMonthlyUsage
} from "@/lib/db/queries";
import { getBillingPlan } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
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

function getErrorField(error: unknown, field: "code" | "message") {
  if (!error || typeof error !== "object") {
    return "";
  }

  const record = error as Record<"code" | "message", unknown>;
  const value = field in record ? record[field] : undefined;

  return value === undefined ? "" : String(value);
}

function getNestedErrorCause(error: unknown) {
  if (!error || typeof error !== "object" || !("cause" in error)) {
    return undefined;
  }

  return error.cause;
}

export function isMissingMonthlyUsageSchemaError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = getErrorField(error, "code");
  const message = getErrorField(error, "message");
  const cause = getNestedErrorCause(error);
  const causeCode = getErrorField(cause, "code");
  const causeMessage = getErrorField(cause, "message");
  const combinedMessage = `${message} ${causeMessage}`;

  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST202" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    causeCode === "42P01" ||
    causeCode === "42703" ||
    causeCode === "PGRST202" ||
    causeCode === "PGRST204" ||
    causeCode === "PGRST205" ||
    (/monthly_usage|increment_monthly_usage/.test(combinedMessage) &&
      /schema cache|does not exist|Could not find|could not find|function|relation/.test(
        combinedMessage
      ))
  );
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
  const [profile, usageResult] = await Promise.all([
    getProfile(supabase, userId),
    getMonthlyUsage(supabase, userId, usageMonth)
      .then((usage) => ({ usage, fallbackTotalGenerations: null }))
      .catch(async (error: unknown) => {
        if (!isMissingMonthlyUsageSchemaError(error)) {
          throw error;
        }

        return {
          usage: null,
          fallbackTotalGenerations: await getMonthlyUsageFromDailyTotals(
            supabase,
            userId,
            usageMonth
          )
        };
      })
  ]);
  const plan = profile?.plan ?? "free";
  const billingPlan = getBillingPlan(plan);
  const totalGenerations =
    usageResult.usage?.total_generations ??
    usageResult.fallbackTotalGenerations ??
    0;
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

export async function recordSuccessfulUsage(
  userId: string,
  quantity = 1,
  fallbackKind?: DailyUsageKind
) {
  const supabase = createSupabaseServerClient();

  try {
    return await incrementMonthlyUsage(supabase, userId, quantity);
  } catch (error) {
    if (!isMissingMonthlyUsageSchemaError(error)) {
      throw error;
    }

    const cause = getNestedErrorCause(error);

    logger.error(
      "Monthly usage recording failed due to operational schema drift",
      {
        userId,
        quantity,
        fallbackKind: fallbackKind ?? null,
        operationalIssue: "monthly_usage_schema_or_rpc_missing",
        error: error instanceof Error ? error.message : String(error),
        cause:
          cause instanceof Error ? cause.message : cause ? String(cause) : null
      }
    );

    if (!fallbackKind) {
      throw error;
    }

    const fallbackUsage = await incrementDailyUsage(
      supabase,
      userId,
      fallbackKind,
      quantity
    );

    logger.warn(
      "Recorded usage with daily usage fallback after monthly schema drift",
      {
        userId,
        quantity,
        fallbackKind,
        operationalIssue: "monthly_usage_schema_or_rpc_missing"
      }
    );

    return fallbackUsage;
  }
}
