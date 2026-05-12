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
    tagline: "Start with essential daily generations.",
    price: "$0",
    cadence: "forever",
    dailyMarketingGenerations: 5,
    dailyImageGenerations: 3,
    features: [
      "5 content generations/day",
      "3 image generations/day",
      "Private creative workspace",
      "Standard generation queue"
    ]
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Higher limits for active production.",
    price: "$29",
    cadence: "per month",
    paypalPlanId: env.PAYPAL_PRO_PLAN_ID,
    dailyMarketingGenerations: 50,
    dailyImageGenerations: 50,
    highlighted: true,
    features: [
      "50 content generations/day",
      "50 image generations/day",
      "Advanced templates",
      "Faster generation queue"
    ]
  },
  {
    id: "agency",
    name: "Agency",
    tagline: "Expanded usage for client work.",
    price: "$99",
    cadence: "per month",
    paypalPlanId: env.PAYPAL_AGENCY_PLAN_ID,
    dailyMarketingGenerations: null,
    dailyImageGenerations: null,
    features: [
      "Fair-use content generations",
      "Fair-use image generations",
      "Client-ready limits",
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
