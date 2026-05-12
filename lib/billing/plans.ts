import type { AppPlan } from "@/lib/db/types";
import { env } from "@/lib/env";

export type BillingPlan = {
  id: AppPlan;
  name: string;
  tagline: string;
  price: string;
  cadence: string;
  paypalPlanId?: string;
  monthlyMarketingGenerations: number;
  monthlyImageGenerations: number;
  monthlyPooledGenerations: number;
  features: string[];
  highlighted?: boolean;
};

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Perfect for testing the platform.",
    price: "£0",
    cadence: "per month",
    monthlyMarketingGenerations: 2,
    monthlyImageGenerations: 2,
    monthlyPooledGenerations: 4,
    features: [
      "Core creative tools",
      "Private workspace",
      "Standard processing"
    ]
  },
  {
    id: "pro",
    name: "Creator",
    tagline: "Built for consistent campaign creation.",
    price: "£10",
    cadence: "per month",
    paypalPlanId: env.PAYPAL_PRO_PLAN_ID,
    monthlyMarketingGenerations: 25,
    monthlyImageGenerations: 25,
    monthlyPooledGenerations: 50,
    highlighted: true,
    features: [
      "Advanced templates",
      "Faster processing",
      "Campaign-ready exports"
    ]
  },
  {
    id: "agency",
    name: "Studio",
    tagline: "High-volume generation for businesses and agencies.",
    price: "£50",
    cadence: "per month",
    paypalPlanId: env.PAYPAL_AGENCY_PLAN_ID,
    monthlyMarketingGenerations: 125,
    monthlyImageGenerations: 125,
    monthlyPooledGenerations: 250,
    features: [
      "Priority processing",
      "Business workflow support",
      "Business-ready workspace"
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

export function formatPlanLimit(limit: number) {
  return `${limit}`;
}
