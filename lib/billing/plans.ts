import type { AppPlan } from "@/lib/db/types";
import { env } from "@/lib/env";

export type BillingPlan = {
  id: AppPlan;
  name: string;
  tagline: string;
  price: string;
  cadence: string;
  paypalPlanId?: string;
  dailyMarketingGenerations: number | null;
  dailyImageGenerations: number | null;
  features: string[];
  highlighted?: boolean;
};

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Validate campaigns before you scale.",
    price: "$0",
    cadence: "forever",
    dailyMarketingGenerations: 5,
    dailyImageGenerations: 3,
    features: [
      "5 marketing generations/day",
      "3 image generations/day",
      "Core campaign workspace",
      "Standard generation queue"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "High-output content engine for growing teams.",
    price: "$29",
    cadence: "per month",
    paypalPlanId: env.PAYPAL_PRO_PLAN_ID,
    dailyMarketingGenerations: 50,
    dailyImageGenerations: 50,
    highlighted: true,
    features: [
      "50 marketing generations/day",
      "50 image generations/day",
      "Premium templates",
      "Faster generations"
    ]
  },
  {
    id: "agency",
    name: "Agency",
    tagline: "Production-ready limits for client delivery.",
    price: "$99",
    cadence: "per month",
    paypalPlanId: env.PAYPAL_AGENCY_PLAN_ID,
    dailyMarketingGenerations: null,
    dailyImageGenerations: null,
    features: [
      "Fair-use marketing generations",
      "Fair-use image generations",
      "Team-ready limits",
      "Priority processing"
    ]
  }
];

export function getBillingPlan(plan: AppPlan) {
  return billingPlans.find((item) => item.id === plan) ?? billingPlans[0];
}

export function getPlanByPayPalPlanId(paypalPlanId?: string | null) {
  if (!paypalPlanId) {
    return null;
  }

  return (
    billingPlans.find((item) => item.paypalPlanId === paypalPlanId) ?? null
  );
}

export function isPaidPlan(plan: AppPlan) {
  return plan === "pro" || plan === "agency";
}

export function formatPlanLimit(limit: number | null) {
  return limit === null ? "Fair use" : `${limit}/day`;
}
