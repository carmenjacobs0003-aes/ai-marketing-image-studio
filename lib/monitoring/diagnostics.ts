import { env, getRedisEnv, validateProductionEnv } from "@/lib/env";
import { isSupportedImageModel } from "@/lib/openai/images";

export type DiagnosticStatus = "pass" | "warn" | "fail";

export type DiagnosticCheck = {
  name: string;
  status: DiagnosticStatus;
  detail: string;
  recovery?: string;
};

function check(
  name: string,
  pass: boolean,
  detail: string,
  recovery?: string
): DiagnosticCheck {
  return { name, status: pass ? "pass" : "fail", detail, recovery };
}

export function getApplicationDiagnostics(): DiagnosticCheck[] {
  const production = validateProductionEnv(env);

  const checks: DiagnosticCheck[] = [
    check(
      "Production environment",
      production.valid,
      production.valid
        ? "All required production variables are present."
        : `Missing: ${production.missing.join(", ")}`,
      "Set the missing variables before launch."
    ),

    check(
      "OpenAI provider",
      Boolean(env.OPENAI_API_KEY),
      "Image and marketing generation require an OpenAI API key.",
      "Set OPENAI_API_KEY and verify account quota, billing, and organization verification."
    ),

    check(
      "OpenAI image model",
      isSupportedImageModel(env.OPENAI_IMAGE_MODEL),
      `Runtime OPENAI_IMAGE_MODEL=${env.OPENAI_IMAGE_MODEL}.`,
      "Use gpt-image-1, gpt-image-1-mini, gpt-image-1.5, dall-e-2, or dall-e-3."
    ),

    check(
      "Supabase data plane",
      Boolean(
        env.NEXT_PUBLIC_SUPABASE_URL &&
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        env.SUPABASE_SERVICE_ROLE_KEY
      ),
      "Auth, application data, storage, and admin analytics use Supabase.",
      "Set Supabase URL, anon key, and service role key."
    ),

    check(
      "Redis throttling",
      getRedisEnv(env).configured,
      "Distributed rate limits and queue protection use Upstash Redis in production.",
      "Set Upstash REST URL and token for multi-region throttling."
    ),

    check(
      "PayPal webhook validation",
      Boolean(
        env.PAYPAL_WEBHOOK_ID &&
        env.PAYPAL_CLIENT_ID &&
        env.PAYPAL_CLIENT_SECRET
      ),
      "Billing webhooks must be signed by PayPal before subscription sync.",
      "Create a PayPal webhook and configure PAYPAL_WEBHOOK_ID."
    ),

    check(
      "Critical alerts",
      Boolean(env.CRITICAL_ALERT_WEBHOOK_URL),
      "Critical failures should notify operators immediately.",
      "Set CRITICAL_ALERT_WEBHOOK_URL."
    )
  ];

  return checks;
}

export function summarizeDiagnostics(checks = getApplicationDiagnostics()) {
  const failed = checks.filter((item) => item.status === "fail").length;

  const warnings = checks.filter((item) => item.status === "warn").length;

  return {
    status: failed > 0 ? "fail" : warnings > 0 ? "warn" : "pass",
    failed,
    warnings,
    passed: checks.filter((item) => item.status === "pass").length,
    checks
  };
}
