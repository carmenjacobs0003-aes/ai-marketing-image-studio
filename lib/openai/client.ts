import OpenAI from "openai";
import { env } from "@/lib/env";

export function createOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY.");
  }

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: env.API_TIMEOUT_SECONDS * 1000,
    maxRetries: env.PROVIDER_RETRY_ATTEMPTS
  });
}
