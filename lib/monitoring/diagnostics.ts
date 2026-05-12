import {
  env,
  getDeploymentEnvironmentDiagnostics,
  getRedisEnv,
  OPENAI_API_KEY_ENV_VAR_NAME,
  validateProductionEnv
} from "@/lib/env";
import { isSupportedImageModel } from "@/lib/openai/images";
import { createOpenAIClient } from "@/lib/openai/client";
import { redis, verifyRedisConnection } from "@/lib/redis/client";
import { isRedisAuthError } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GENERATED_IMAGES_BUCKET } from "@/lib/storage/images";
import { logger } from "@/lib/logger";

export type DiagnosticStatus = "pass" | "warn" | "fail";

export type DiagnosticCheck = {
  name: string;
  status: DiagnosticStatus;
  detail: string;
  recovery?: string;
  diagnostics?: Record<string, unknown>;
};

function check(
  name: string,
  pass: boolean,
  detail: string,
  recovery?: string,
  diagnostics?: Record<string, unknown>
): DiagnosticCheck {
  return {
    name,
    status: pass ? "pass" : "fail",
    detail,
    recovery,
    diagnostics
  };
}

function warn(
  name: string,
  detail: string,
  recovery?: string,
  diagnostics?: Record<string, unknown>
): DiagnosticCheck {
  return { name, status: "warn", detail, recovery, diagnostics };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getRequiredRuntimeEnvironmentDiagnostics() {
  return {
    OPENAI_API_KEY: Boolean(env.OPENAI_API_KEY),
    UPSTASH_REDIS_REST_URL: Boolean(env.UPSTASH_REDIS_REST_URL),
    UPSTASH_REDIS_REST_TOKEN: Boolean(env.UPSTASH_REDIS_REST_TOKEN),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(env.SUPABASE_SERVICE_ROLE_KEY)
  };
}

async function checkOpenAIConnectivity(): Promise<DiagnosticCheck> {
  const startedAt = Date.now();

  if (!env.OPENAI_API_KEY) {
    return check(
      "OpenAI connectivity",
      false,
      `${OPENAI_API_KEY_ENV_VAR_NAME} is missing server-side.`,
      "Set OPENAI_API_KEY in Vercel production environment variables and redeploy.",
      { hasOpenAIKey: false }
    );
  }

  try {
    logger.info("Diagnostics OpenAI connectivity check start", {
      model: env.OPENAI_IMAGE_MODEL,
      hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
      runtimeHasOpenAIKey: Boolean(process.env[OPENAI_API_KEY_ENV_VAR_NAME])
    });

    const result = await createOpenAIClient().models.list().withResponse();

    logger.info("Diagnostics OpenAI connectivity check completed", {
      durationMs: Date.now() - startedAt,
      status: result.response.status,
      requestId: result.request_id,
      modelCount: result.data.data.length
    });

    return check(
      "OpenAI connectivity",
      true,
      "OpenAI API responded to a models.list probe.",
      undefined,
      {
        durationMs: Date.now() - startedAt,
        status: result.response.status,
        requestId: result.request_id,
        modelCount: result.data.data.length,
        configuredImageModel: env.OPENAI_IMAGE_MODEL,
        imageModelSupportedByApp: isSupportedImageModel(env.OPENAI_IMAGE_MODEL)
      }
    );
  } catch (error) {
    const message = getErrorMessage(error);

    logger.error("Diagnostics OpenAI connectivity check failed", {
      durationMs: Date.now() - startedAt,
      error: message,
      hasOpenAIKey: Boolean(env.OPENAI_API_KEY)
    });

    return check(
      "OpenAI connectivity",
      false,
      `OpenAI API probe failed: ${message}`,
      "Verify OPENAI_API_KEY, project/org settings, billing, quota, and model access.",
      { durationMs: Date.now() - startedAt }
    );
  }
}

async function checkRedisConnectivity(): Promise<DiagnosticCheck> {
  const startedAt = Date.now();
  const redisEnv = getRedisEnv(env);

  logger.info("Diagnostics Redis connectivity check start", {
    redis: {
      configured: redisEnv.configured,
      source: redisEnv.source,
      hasUrl: Boolean(redisEnv.url),
      hasToken: Boolean(redisEnv.token),
      missing: redisEnv.missing
    }
  });

  const verification = await verifyRedisConnection({
    source: "diagnostics_endpoint"
  });

  if (verification.ok) {
    return check(
      "Redis connectivity",
      true,
      "Redis ping succeeded.",
      undefined,
      { durationMs: Date.now() - startedAt, verification }
    );
  }

  const authFailure = isRedisAuthError(
    verification.error ?? verification.reason
  );

  logger[authFailure ? "warn" : "error"](
    "Diagnostics Redis connectivity check failed",
    {
      durationMs: Date.now() - startedAt,
      authFailure,
      verification
    }
  );

  if (authFailure) {
    return warn(
      "Redis connectivity",
      "Redis authentication failed. Image generation will bypass Redis rate limiting temporarily and continue.",
      "Fix UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel, then redeploy.",
      { durationMs: Date.now() - startedAt, authFailure, verification }
    );
  }

  if (!redis) {
    return warn(
      "Redis connectivity",
      "Redis is not configured. Image generation will use local in-memory rate limiting.",
      "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for distributed production throttling.",
      { durationMs: Date.now() - startedAt, verification }
    );
  }

  return check(
    "Redis connectivity",
    false,
    `Redis ping failed: ${verification.error ?? verification.reason}`,
    "Verify Upstash REST URL/token and network reachability.",
    { durationMs: Date.now() - startedAt, verification }
  );
}

async function checkSupabaseConnectivity(): Promise<DiagnosticCheck> {
  const startedAt = Date.now();

  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return check(
      "Supabase connectivity",
      false,
      "Supabase URL, anon key, or service role key is missing.",
      "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
      getRequiredRuntimeEnvironmentDiagnostics()
    );
  }

  try {
    logger.info("Diagnostics Supabase connectivity check start", {
      hasSupabaseUrl: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasSupabaseServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      bucket: GENERATED_IMAGES_BUCKET
    });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage.getBucket(
      GENERATED_IMAGES_BUCKET
    );

    if (error) {
      throw new Error(error.message);
    }

    logger.info("Diagnostics Supabase connectivity check completed", {
      durationMs: Date.now() - startedAt,
      bucket: data?.name ?? GENERATED_IMAGES_BUCKET
    });

    return check(
      "Supabase connectivity",
      true,
      `Supabase service role reached storage bucket '${GENERATED_IMAGES_BUCKET}'.`,
      undefined,
      {
        durationMs: Date.now() - startedAt,
        bucket: data?.name ?? GENERATED_IMAGES_BUCKET
      }
    );
  } catch (error) {
    const message = getErrorMessage(error);

    logger.error("Diagnostics Supabase connectivity check failed", {
      durationMs: Date.now() - startedAt,
      bucket: GENERATED_IMAGES_BUCKET,
      error: message
    });

    return check(
      "Supabase connectivity",
      false,
      `Supabase storage probe failed: ${message}`,
      "Verify Supabase credentials and that the generated-images storage bucket exists.",
      { durationMs: Date.now() - startedAt, bucket: GENERATED_IMAGES_BUCKET }
    );
  }
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
      "Set the missing variables before launch.",
      getRequiredRuntimeEnvironmentDiagnostics()
    ),

    check(
      "OpenAI provider",
      Boolean(env.OPENAI_API_KEY),
      `Image and marketing generation require ${OPENAI_API_KEY_ENV_VAR_NAME}. Runtime detected: ${Boolean(process.env[OPENAI_API_KEY_ENV_VAR_NAME])}. Parsed env detected: ${Boolean(env.OPENAI_API_KEY)}. Project configured: ${Boolean(env.OPENAI_PROJECT_ID)}. Organization configured: ${Boolean(env.OPENAI_ORGANIZATION)}.`,
      "Set OPENAI_API_KEY and verify account quota, billing, project access, model permissions, and organization verification."
    ),

    check(
      "OpenAI image model",
      isSupportedImageModel(env.OPENAI_IMAGE_MODEL),
      `Runtime OPENAI_IMAGE_MODEL=${env.OPENAI_IMAGE_MODEL}.`,
      "Use gpt-image-1, gpt-image-1-mini, gpt-image-1.5, gpt-image-2, dall-e-2, or dall-e-3."
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
      "Distributed rate limits and queue protection use Upstash Redis in production. Redis auth failures are temporarily bypassed for image generation.",
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
    deploymentEnvironment: getDeploymentEnvironmentDiagnostics(
      process.env,
      env
    ),
    requiredRuntimeEnvironment: getRequiredRuntimeEnvironmentDiagnostics(),
    failed,
    warnings,
    passed: checks.filter((item) => item.status === "pass").length,
    checks
  };
}

export async function runConnectivityDiagnostics() {
  const checks = [
    ...getApplicationDiagnostics(),
    ...(await Promise.all([
      checkOpenAIConnectivity(),
      checkRedisConnectivity(),
      checkSupabaseConnectivity()
    ]))
  ];

  return summarizeDiagnostics(checks);
}
