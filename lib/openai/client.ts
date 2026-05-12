import OpenAI from "openai";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export function createOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY.");
  }

  logger.info("OpenAI client initialization", {
    hasApiKey: Boolean(env.OPENAI_API_KEY),
    timeoutMs: env.API_TIMEOUT_SECONDS * 1000,
    maxRetries: env.PROVIDER_RETRY_ATTEMPTS,
    projectConfigured: Boolean(env.OPENAI_PROJECT_ID),
    organizationConfigured: Boolean(env.OPENAI_ORGANIZATION)
  });

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: env.API_TIMEOUT_SECONDS * 1000,
    maxRetries: env.PROVIDER_RETRY_ATTEMPTS,
    project: env.OPENAI_PROJECT_ID,
    organization: env.OPENAI_ORGANIZATION
  });
}
