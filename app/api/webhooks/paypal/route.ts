import { NextResponse, type NextRequest } from "next/server";
import type { AppPlan, Json } from "@/lib/db/types";
import { getPlanByPayPalPlanId } from "@/lib/billing/plans";
import {
  getProfileByPayPalSubscriptionId,
  recordPayPalWebhookEvent,
  syncProfileSubscription
} from "@/lib/db/queries";
import {
  getPayPalSubscription,
  verifyPayPalWebhook
} from "@/lib/paypal/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    plan_id?: string;
    status?: string;
    custom_id?: string;
    subscriber?: {
      payer_id?: string;
      email_address?: string;
    };
    billing_info?: {
      next_billing_time?: string;
    };
  };
};

const PAYPAL_STATUS_TO_PROFILE_STATUS = {
  APPROVAL_PENDING: "approval_pending",
  APPROVED: "approval_pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
  EXPIRED: "expired"
} as const;

function toProfileStatus(status?: string) {
  return status
    ? (PAYPAL_STATUS_TO_PROFILE_STATUS[
        status as keyof typeof PAYPAL_STATUS_TO_PROFILE_STATUS
      ] ?? "past_due")
    : "past_due";
}

function planForStatus(
  planId: string | null | undefined,
  status?: string
): AppPlan {
  const subscriptionPlan = getPlanByPayPalPlanId(planId);
  const profileStatus = toProfileStatus(status);

  return profileStatus === "active" && subscriptionPlan
    ? subscriptionPlan.id
    : "free";
}

async function resolveSubscriptionResource(event: PayPalWebhookEvent) {
  const resource = event.resource ?? {};
  const subscriptionId = resource.id;

  if (!subscriptionId) {
    return resource;
  }

  if (resource.plan_id && resource.custom_id && resource.status) {
    return resource;
  }

  try {
    return await getPayPalSubscription(subscriptionId);
  } catch {
    return resource;
  }
}

export async function POST(request: NextRequest) {
  const event = (await request.json()) as PayPalWebhookEvent;
  const verified = await verifyPayPalWebhook({
    transmissionId: request.headers.get("paypal-transmission-id"),
    transmissionTime: request.headers.get("paypal-transmission-time"),
    certUrl: request.headers.get("paypal-cert-url"),
    authAlgo: request.headers.get("paypal-auth-algo"),
    transmissionSig: request.headers.get("paypal-transmission-sig"),
    webhookEvent: event
  });

  if (!verified) {
    return NextResponse.json(
      { error: "Invalid PayPal webhook signature" },
      { status: 401 }
    );
  }

  const eventId = event.id;
  const eventType = event.event_type;

  if (!eventId || !eventType) {
    return NextResponse.json(
      { error: "Invalid PayPal webhook payload" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const resource = await resolveSubscriptionResource(event);
  const subscriptionId = resource.id ?? null;

  await recordPayPalWebhookEvent(supabase, {
    id: eventId,
    event_type: eventType,
    paypal_subscription_id: subscriptionId,
    payload: JSON.parse(JSON.stringify(event)) as Json
  });

  if (!eventType.startsWith("BILLING.SUBSCRIPTION.")) {
    return NextResponse.json({ received: true, ignored: true });
  }

  if (!subscriptionId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const existingProfile = await getProfileByPayPalSubscriptionId(
    supabase,
    subscriptionId
  );
  const userId = resource.custom_id ?? existingProfile?.id;

  if (!userId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  await syncProfileSubscription(supabase, {
    userId,
    plan: planForStatus(resource.plan_id, resource.status),
    subscriptionStatus: toProfileStatus(resource.status),
    paypalSubscriptionId: subscriptionId,
    paypalPlanId: resource.plan_id ?? existingProfile?.paypal_plan_id ?? null,
    paypalCustomerId:
      resource.subscriber?.payer_id ??
      existingProfile?.paypal_customer_id ??
      null,
    currentPeriodEnd:
      resource.billing_info?.next_billing_time ??
      existingProfile?.subscription_current_period_end ??
      null,
    cancelAt: resource.status === "CANCELLED" ? new Date().toISOString() : null
  });

  return NextResponse.json({ received: true });
}
