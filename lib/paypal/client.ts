import { env } from "@/lib/env";

const PAYPAL_API_BASE = env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export async function getPayPalAccessToken() {
  const credentials = Buffer.from(`${env.PAYPAL_CLIENT_ID ?? ""}:${env.PAYPAL_CLIENT_SECRET ?? ""}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    throw new Error("Unable to authenticate with PayPal");
  }

  return response.json() as Promise<{ access_token: string }>;
}

export { PAYPAL_API_BASE };
