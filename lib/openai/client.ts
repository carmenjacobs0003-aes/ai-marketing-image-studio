import OpenAI from "openai";
import {
  env,
  getDeploymentEnvironmentDiagnostics,
  OPENAI_API_KEY_ENV_VAR_NAME
} from "@/lib/env";
import { logger } from "@/lib/logger";

export function createOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    logger.error("OpenAI API key missing at client initialization", {
      debugReason: "missing_openai_api_key",
      expectedEnvironmentVariable: OPENAI_API_KEY_ENV_VAR_NAME,
      deploymentEnvironment: getDeploymentEnvironmentDiagnostics(
        process.env,
        env
      )
    });
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY.");
  }

  logger.info("OpenAI client initialization", {
    debugReason: "openai_client_environment_verified",
    expectedEnvironmentVariable: OPENAI_API_KEY_ENV_VAR_NAME,
    hasApiKey: Boolean(env.OPENAI_API_KEY),
    runtimeHasApiKey: Boolean(process.env[OPENAI_API_KEY_ENV_VAR_NAME]),
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
