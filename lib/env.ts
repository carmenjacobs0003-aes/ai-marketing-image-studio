import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/branding";
import { z } from "zod";

export const OPENAI_API_KEY_ENV_VAR_NAME = "OPENAI_API_KEY" as const;
export const OPENAI_IMAGE_MODEL_ENV_VAR_NAME = "OPENAI_IMAGE_MODEL" as const;
export const POLLINATIONS_API_KEY_ENV_VAR_NAME =
  "POLLINATIONS_API_KEY" as const;
export const envLoadedAt = new Date().toISOString();

const baseEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default(BRAND_NAME),
  NEXT_PUBLIC_APP_DESCRIPTION: z.string().default(BRAND_DESCRIPTION),
  NEXT_PUBLIC_SITE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  [OPENAI_API_KEY_ENV_VAR_NAME]: z.string().optional(),
  [POLLINATIONS_API_KEY_ENV_VAR_NAME]: z.string().optional(),
  OPENAI_PROJECT_ID: z.string().optional(),
  OPENAI_ORGANIZATION: z.string().optional(),
  OPENAI_TEXT_MODEL: z.string().default("gpt-4o-mini"),
  [OPENAI_IMAGE_MODEL_ENV_VAR_NAME]: z.string().default("gpt-image-1"),
  API_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),
  PROVIDER_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
  PROVIDER_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(500),
  PROVIDER_RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(4000),
  GENERATION_QUEUE_LIMIT: z.coerce.number().int().positive().default(3),
  GENERATION_QUEUE_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(120),
  CRITICAL_ALERT_WEBHOOK_URL: z.string().url().optional(),
  CRITICAL_ALERT_COOLDOWN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),
  IMAGE_GENERATION_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600),
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  NEXT_PUBLIC_PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  PAYPAL_PRO_PLAN_ID: z.string().optional(),
  PAYPAL_AGENCY_PLAN_ID: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1)
});

export const productionRequiredKeys = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_DOMAIN",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "NEXT_PUBLIC_PAYPAL_CLIENT_ID",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_PRO_PLAN_ID",
  "PAYPAL_AGENCY_PLAN_ID"
] as const;

export const redisRequiredKeys = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN"
] as const;

export const redisVercelKvAliasKeys = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN"
] as const;

export const paypalLiveRequiredKeys = [
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "NEXT_PUBLIC_PAYPAL_CLIENT_ID",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_PRO_PLAN_ID",
  "PAYPAL_AGENCY_PLAN_ID"
] as const;

export const envSchema = baseEnvSchema;
export type AppEnv = z.infer<typeof envSchema>;

export function shouldEnforceProductionEnv(values = process.env) {
  return (
    values.ENFORCE_PRODUCTION_ENV === "true" ||
    (values.VERCEL === "1" && values.VERCEL_ENV === "production")
  );
}

export function getDeploymentEnvironmentDiagnostics(
  values = process.env,
  parsedEnv?: Pick<
    AppEnv,
    | "OPENAI_API_KEY"
    | "OPENAI_IMAGE_MODEL"
    | "OPENAI_PROJECT_ID"
    | "OPENAI_ORGANIZATION"
    | "POLLINATIONS_API_KEY"
  >
) {
  return {
    envLoadedAt,
    source: "server process.env",
    nodeEnv: values.NODE_ENV ?? null,
    vercel: values.VERCEL === "1",
    vercelEnv: values.VERCEL_ENV ?? null,
    vercelRegion: values.VERCEL_REGION ?? null,
    vercelUrl: values.VERCEL_URL ?? null,
    vercelGitCommitSha: values.VERCEL_GIT_COMMIT_SHA ?? null,
    productionEnvEnforced: shouldEnforceProductionEnv(values),
    exactEnvironmentVariables: {
      openaiApiKey: OPENAI_API_KEY_ENV_VAR_NAME,
      openaiImageModel: OPENAI_IMAGE_MODEL_ENV_VAR_NAME,
      openaiProject: "OPENAI_PROJECT_ID",
      openaiOrganization: "OPENAI_ORGANIZATION",
      pollinationsApiKey: POLLINATIONS_API_KEY_ENV_VAR_NAME
    },
    runtimeEnvironmentVariables: {
      openaiApiKeyDetected: Boolean(values[OPENAI_API_KEY_ENV_VAR_NAME]),
      openaiImageModel: values[OPENAI_IMAGE_MODEL_ENV_VAR_NAME] ?? null,
      openaiProjectConfigured: Boolean(values.OPENAI_PROJECT_ID),
      openaiOrganizationConfigured: Boolean(values.OPENAI_ORGANIZATION),
      pollinationsApiKeyDetected: Boolean(
        values[POLLINATIONS_API_KEY_ENV_VAR_NAME]
      )
    },
    parsedEnvironmentVariables: parsedEnv
      ? {
          openaiApiKeyDetected: Boolean(parsedEnv.OPENAI_API_KEY),
          openaiImageModel: parsedEnv.OPENAI_IMAGE_MODEL,
          openaiProjectConfigured: Boolean(parsedEnv.OPENAI_PROJECT_ID),
          openaiOrganizationConfigured: Boolean(parsedEnv.OPENAI_ORGANIZATION),
          pollinationsApiKeyDetected: Boolean(parsedEnv.POLLINATIONS_API_KEY)
        }
      : undefined
  };
}

export function getRedisEnv(
  values: Pick<
    AppEnv,
    | "UPSTASH_REDIS_REST_URL"
    | "UPSTASH_REDIS_REST_TOKEN"
    | "KV_REST_API_URL"
    | "KV_REST_API_TOKEN"
  >
) {
  const url = values.UPSTASH_REDIS_REST_URL ?? values.KV_REST_API_URL;
  const token = values.UPSTASH_REDIS_REST_TOKEN ?? values.KV_REST_API_TOKEN;
  const source = values.UPSTASH_REDIS_REST_URL
    ? "upstash"
    : values.KV_REST_API_URL
      ? "vercel-kv-alias"
      : null;

  return {
    url,
    token,
    source,
    configured: Boolean(url && token),
    missing: [
      ...(!url ? ["UPSTASH_REDIS_REST_URL"] : []),
      ...(!token ? ["UPSTASH_REDIS_REST_TOKEN"] : [])
    ]
  };
}

export function validateProductionEnv(values: AppEnv) {
  const missing: string[] = productionRequiredKeys.filter(
    (key) => !values[key]
  );
  const redisEnv = getRedisEnv(values);

  if (!redisEnv.configured) {
    missing.push(...redisEnv.missing);
  }

  if (values.PAYPAL_ENV === "live") {
    missing.push(...paypalLiveRequiredKeys.filter((key) => !values[key]));
  }

  return {
    valid: missing.length === 0,
    missing: Array.from(new Set(missing))
  };
}

function parseEnv() {
  const parsed = envSchema.parse(process.env);
  const productionValidation = validateProductionEnv(parsed);

  const blockingMissing = productionValidation.missing.filter(
    (key) =>
      !redisRequiredKeys.includes(key as (typeof redisRequiredKeys)[number])
  );

  if (shouldEnforceProductionEnv() && blockingMissing.length > 0) {
    throw new Error(
      `Missing production environment variables: ${blockingMissing.join(", ")}`
    );
  }

  return parsed;
}

export const env = parseEnv();
