import { env } from "@/lib/env";
import { logCentralizedError } from "@/lib/monitoring/errors";
import { normalizeFailureMessage, withRetry } from "@/lib/resilience";

const PAYPAL_API_BASE =
  env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

type PayPalLink = {
  href: string;
  rel: string;
  method?: string;
};

export type PayPalSubscription = {
  id: string;
  plan_id?: string;
  status?: string;
  custom_id?: string;
  subscriber?: {
    payer_id?: string;
    email_address?: string;
  };
  billing_info?: {
    next_billing_time?: string;
    last_payment?: {
      time?: string;
    };
  };
  links?: PayPalLink[];
};

function requirePayPalConfig() {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new Error(
      "PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
    );
  }
}

export async function getPayPalAccessToken() {
  requirePayPalConfig();
  const credentials = Buffer.from(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");
  const response = await withRetry(() => fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    cache: "no-store"
  }), { label: "paypal.oauth" }).catch(async (error) => {
    await logCentralizedError(error, {
      category: "paypal",
      provider: "paypal",
      message: normalizeFailureMessage("PayPal authentication", error),
      severity: "critical"
    });
    throw error;
  });

  if (!response.ok) {
    throw new Error("Unable to authenticate with PayPal");
  }

  return response.json() as Promise<{ access_token: string }>;
}

export async function paypalFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { access_token: accessToken } = await getPayPalAccessToken();
  const response = await withRetry(() => fetch(`${PAYPAL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init.headers
    },
    cache: "no-store"
  }), { label: `paypal${path}` }).catch(async (error) => {
    await logCentralizedError(error, {
      category: "paypal",
      provider: "paypal",
      message: normalizeFailureMessage("PayPal API", error),
      severity: "critical",
      context: { path }
    });
    throw error;
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `PayPal API request failed (${response.status}): ${body || response.statusText}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function createPayPalSubscription(input: {
  planId: string;
  userId: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  return paypalFetch<PayPalSubscription>("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: input.planId,
      custom_id: input.userId,
      application_context: {
        brand_name: "SYNTRIX AI",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        payment_method: {
          payer_selected: "PAYPAL",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED"
        },
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl
      }
    })
  });
}

export function getPayPalApprovalUrl(subscription: PayPalSubscription) {
  return (
    subscription.links?.find((link) => link.rel === "approve")?.href ?? null
  );
}

export function getPayPalSubscription(subscriptionId: string) {
  return paypalFetch<PayPalSubscription>(
    `/v1/billing/subscriptions/${subscriptionId}`
  );
}

export function cancelPayPalSubscription(
  subscriptionId: string,
  reason: string
) {
  return paypalFetch<void>(
    `/v1/billing/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ reason })
    }
  );
}

export async function verifyPayPalWebhook(input: {
  transmissionId: string | null;
  transmissionTime: string | null;
  certUrl: string | null;
  authAlgo: string | null;
  transmissionSig: string | null;
  webhookEvent: unknown;
}) {
  if (!env.PAYPAL_WEBHOOK_ID) {
    throw new Error("PayPal webhook verification is not configured.");
  }

  if (!input.transmissionId || !input.transmissionTime || !input.certUrl || !input.authAlgo || !input.transmissionSig) {
    return false;
  }

  const result = await paypalFetch<{ verification_status: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        transmission_id: input.transmissionId,
        transmission_time: input.transmissionTime,
        cert_url: input.certUrl,
        auth_algo: input.authAlgo,
        transmission_sig: input.transmissionSig,
        webhook_id: env.PAYPAL_WEBHOOK_ID,
        webhook_event: input.webhookEvent
      })
    }
  );

  return result.verification_status === "SUCCESS";
}

export { PAYPAL_API_BASE };
