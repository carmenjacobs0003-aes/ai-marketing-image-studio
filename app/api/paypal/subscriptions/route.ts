import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getBillingPlan } from "@/lib/billing/plans";
import { updateProfileSubscription } from "@/lib/db/queries";
import {
  createPayPalSubscription,
  getPayPalApprovalUrl
} from "@/lib/paypal/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

const requestSchema = z.object({
  plan: z.enum(["pro", "agency"])
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Select a valid paid subscription plan." },
      { status: 400 }
    );
  }

  const plan = getBillingPlan(parsed.data.plan);

  if (!plan.paypalPlanId) {
    return NextResponse.json(
      { error: `${plan.name} is not configured for PayPal checkout.` },
      { status: 503 }
    );
  }

  const subscription = await createPayPalSubscription({
    planId: plan.paypalPlanId,
    userId: user.id,
    returnUrl: `${env.NEXT_PUBLIC_APP_URL}/billing?paypal=approved`,
    cancelUrl: `${env.NEXT_PUBLIC_APP_URL}/pricing?paypal=cancelled`
  });
  const approvalUrl = getPayPalApprovalUrl(subscription);

  if (!approvalUrl) {
    return NextResponse.json(
      { error: "PayPal did not return an approval URL." },
      { status: 502 }
    );
  }

  await updateProfileSubscription(createSupabaseAdminClient(), user.id, {
    plan: "free",
    subscription_status: "approval_pending",
    paypal_subscription_id: subscription.id,
    paypal_plan_id: plan.paypalPlanId
  });

  return NextResponse.json({ approvalUrl, subscriptionId: subscription.id });
}
