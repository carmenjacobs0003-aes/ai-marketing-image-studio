import OpenAI from "openai";
import { env } from "@/lib/env";

export function createOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY.");
  }

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY
  });
}
