import { z } from "zod";

const baseEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("SYNTRIX AI"),
  NEXT_PUBLIC_APP_DESCRIPTION: z
    .string()
    .default("Create campaign-ready marketing images and copy with AI."),
  NEXT_PUBLIC_SITE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TEXT_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_IMAGE_MODEL: z.string().default("dall-e-3"),
  API_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),
  PROVIDER_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
  PROVIDER_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(500),
  PROVIDER_RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(4000),
  GENERATION_QUEUE_LIMIT: z.coerce.number().int().positive().default(3),
  GENERATION_QUEUE_WINDOW_SECONDS: z.coerce.number().int().positive().default(120),
  CRITICAL_ALERT_WEBHOOK_URL: z.string().url().optional(),
  CRITICAL_ALERT_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(300),
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
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "NEXT_PUBLIC_PAYPAL_CLIENT_ID",
  "PAYPAL_WEBHOOK_ID",
  "PAYPAL_PRO_PLAN_ID",
  "PAYPAL_AGENCY_PLAN_ID",
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

export function validateProductionEnv(values: AppEnv) {
  const missing: string[] = productionRequiredKeys.filter(
    (key) => !values[key]
  );

  if (values.PAYPAL_ENV === "live") {
    missing.push(...paypalLiveRequiredKeys.filter((key) => !values[key]));
  }

  return {
    valid: missing.length === 0,
    missing
  };
}

function parseEnv() {
  const parsed = envSchema.parse(process.env);
  const productionValidation = validateProductionEnv(parsed);

  if (shouldEnforceProductionEnv() && !productionValidation.valid) {
    throw new Error(
      `Missing production environment variables: ${productionValidation.missing.join(", ")}`
    );
  }

  return parsed;
}

export const env = parseEnv();
