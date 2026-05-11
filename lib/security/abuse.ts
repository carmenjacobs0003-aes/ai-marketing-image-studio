import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const SPAM_PATTERNS = [
  /(https?:\/\/|www\.)\S+/gi,
  /(.)\1{18,}/g,
  /\b(?:free\s+money|crypto\s+airdrop|guaranteed\s+profit)\b/i
];

const DISALLOWED_GENERATION_PATTERNS = [
  /\b(?:deepfake|fake\s+id|passport|driver'?s license|credit card)\b/i,
  /\b(?:exploit|phishing|malware|ransomware|credential)\b/i,
  /\b(?:sexualized\s+minor|underage\s+sexual|child\s+sexual)\b/i
];

export type AbuseDecision = {
  allowed: boolean;
  reason?: string;
  score: number;
  signals: string[];
};

export function inspectPromptForAbuse(prompt: string): AbuseDecision {
  const signals: string[] = [];
  const normalized = prompt.trim();

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(normalized)) signals.push("spam_pattern");
  }

  for (const pattern of DISALLOWED_GENERATION_PATTERNS) {
    if (pattern.test(normalized)) signals.push("disallowed_generation_intent");
  }

  const uniqueWords = new Set(
    normalized.toLowerCase().split(/\s+/).filter(Boolean)
  );
  if (normalized.length > 500 && uniqueWords.size < 20) {
    signals.push("low_entropy_prompt");
  }

  const score = signals.reduce(
    (total, signal) =>
      total + (signal === "disallowed_generation_intent" ? 80 : 25),
    0
  );

  return {
    allowed: score < 80,
    reason:
      score >= 80
        ? "This request matches abuse-prevention rules. Revise the prompt and try again."
        : undefined,
    score,
    signals: [...new Set(signals)]
  };
}

export async function enforcePromptProtection(input: {
  userId: string;
  prompt: string;
  route: string;
  ip?: string;
}) {
  const inspection = inspectPromptForAbuse(input.prompt);

  if (!inspection.allowed) {
    logger.warn("Blocked abusive generation request", {
      userId: input.userId,
      route: input.route,
      score: inspection.score,
      signals: inspection.signals
    });
    return inspection;
  }

  const limiter = await rateLimit(`abuse:${input.userId}`, 8, 60);
  if (!limiter.success) {
    return {
      allowed: false,
      reason:
        "Too many generation attempts in a short period. Please wait and try again.",
      score: Math.max(inspection.score, 80),
      signals: [...inspection.signals, "burst_generation_attempts"]
    };
  }

  if (input.ip) {
    const ipLimiter = await rateLimit(`abuse-ip:${input.ip}`, 30, 60);
    if (!ipLimiter.success) {
      return {
        allowed: false,
        reason:
          "This network is sending too many requests. Please wait and try again.",
        score: Math.max(inspection.score, 80),
        signals: [...inspection.signals, "network_burst"]
      };
    }
  }

  return inspection;
}
