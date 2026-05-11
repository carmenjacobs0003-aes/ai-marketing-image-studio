import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { buildBrandPromptContext } from "@/lib/brand/prompt";
import {
  createMarketingGeneration,
  getDailyUsage,
  listBrandKits,
  listProjects,
  updateMarketingGeneration,
  type BrandKit,
  type Project
} from "@/lib/db/queries";
import {
  createMarketingCopy,
  getMarketingModelName,
  moderateMarketingInput
} from "@/lib/openai/marketing";
import { getMarketingTemplate } from "@/lib/templates/catalog";
import { isPaidPlan } from "@/lib/billing/plans";
import { marketingContentTypeSchema } from "@/types/marketing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/db/helpers";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { withTimeout } from "@/lib/api/timeout";
import { logCentralizedError } from "@/lib/monitoring/errors";
import { rateLimit } from "@/lib/rate-limit";
import { enforcePromptProtection } from "@/lib/security/abuse";
import {
  assertCanGenerateMarketing,
  recordSuccessfulUsage
} from "@/lib/usage/limits";

const requestSchema = z.object({
  prompt: z.string().trim().min(10).max(4000),
  contentType: marketingContentTypeSchema.default("complete_marketing_pack"),
  projectId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().optional(),
  templateId: z.string().trim().optional()
});

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined
  );
}

type MarketingGenerateResponse =
  | {
      generation: Awaited<ReturnType<typeof createMarketingGeneration>>;
      usage: Awaited<ReturnType<typeof getDailyUsage>>;
    }
  | {
      error: string;
      issues?: z.typeToFlattenedError<z.infer<typeof requestSchema>>;
      usage?: Awaited<ReturnType<typeof assertCanGenerateMarketing>>["usage"];
      categories?: string[];
      fallback?: string;
    };

async function readRequestJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json<MarketingGenerateResponse>(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const parsed = requestSchema.safeParse(await readRequestJson(request));

  if (!parsed.success) {
    return NextResponse.json<MarketingGenerateResponse>(
      {
        error: "Invalid marketing generation request",
        issues: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const abuse = await enforcePromptProtection({
    userId: user.id,
    prompt: payload.prompt,
    route: request.nextUrl.pathname,
    ip: getClientIp(request)
  });

  if (!abuse.allowed) {
    await logCentralizedError(new Error(abuse.reason), {
      category: "abuse",
      message: abuse.reason ?? "Blocked suspicious marketing generation request",
      userId: user.id,
      requestId: request.headers.get("x-request-id"),
      context: { score: abuse.score, signals: abuse.signals }
    });
    return NextResponse.json<MarketingGenerateResponse>(
      { error: abuse.reason ?? "Blocked suspicious request" },
      { status: 429 }
    );
  }

  const queueLimiter = await rateLimit(
    `generation-queue:${user.id}`,
    env.GENERATION_QUEUE_LIMIT,
    env.GENERATION_QUEUE_WINDOW_SECONDS
  );

  if (!queueLimiter.success) {
    return NextResponse.json<MarketingGenerateResponse>(
      {
        error:
          "Your generation queue is full. Please wait for current jobs to finish before starting another."
      },
      { status: 429 }
    );
  }

  const entitlement = await assertCanGenerateMarketing(user.id);

  if (!entitlement.allowed) {
    return NextResponse.json<MarketingGenerateResponse>(
      { error: entitlement.reason, usage: entitlement.usage },
      { status: 402 }
    );
  }

  const supabase =
    createSupabaseServerClient() as unknown as TypedSupabaseClient;

  const [projects, brandKits] = (await Promise.all([
    listProjects(supabase, user.id),
    listBrandKits(supabase, user.id)
  ])) as [Project[], BrandKit[]];
  const project = payload.projectId
    ? projects.find((item) => item.id === payload.projectId)
    : null;

  if (payload.projectId && !project) {
    return NextResponse.json<MarketingGenerateResponse>(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  const selectedBrandKitId =
    payload.brandKitId ??
    project?.brand_kit_id ??
    brandKits.find((item) => item.is_default)?.id;
  const brandKit = selectedBrandKitId
    ? brandKits.find((item) => item.id === selectedBrandKitId)
    : null;

  if (selectedBrandKitId && !brandKit) {
    return NextResponse.json<MarketingGenerateResponse>(
      { error: "Brand kit not found" },
      { status: 404 }
    );
  }

  const template = getMarketingTemplate(payload.templateId);

  if (payload.templateId && !template) {
    return NextResponse.json<MarketingGenerateResponse>(
      { error: "Template not found" },
      { status: 404 }
    );
  }

  if (template?.premium && !isPaidPlan(entitlement.usage.plan)) {
    return NextResponse.json<MarketingGenerateResponse>(
      {
        error: "Premium templates are available on Pro and Agency plans.",
        usage: entitlement.usage
      },
      { status: 402 }
    );
  }

  let generation: Awaited<ReturnType<typeof createMarketingGeneration>> | null = null;

  try {
    const moderation = await moderateMarketingInput(payload.prompt);

    if (moderation.flagged) {
      return NextResponse.json<MarketingGenerateResponse>(
        {
          error:
            "Your brief could not be used because it triggered the safety review. Please revise it and try again.",
          categories: moderation.categories
        },
        { status: 400 }
      );
    }

    generation = await createMarketingGeneration(supabase, {
      user_id: user.id,
      project_id: payload.projectId ?? null,
      brand_kit_id: brandKit?.id ?? null,
      prompt: payload.prompt,
      content_type: payload.contentType,
      model: getMarketingModelName(),
      status: "processing",
      metadata: {
        moderation_id: moderation.moderationId,
        moderation_model: moderation.model,
        template_id: template?.id ?? null,
        template_name: template?.name ?? null
      }
    });

    const copy = await withTimeout(
      createMarketingCopy({
        prompt: payload.prompt,
        contentType: payload.contentType,
        brandContext: buildBrandPromptContext(brandKit),
        templateInstruction: template?.prompt
      }),
      env.API_TIMEOUT_SECONDS * 1000
    );

    const completedGeneration = await updateMarketingGeneration(
      supabase,
      generation.id,
      user.id,
      {
        status: "completed",
        output: copy.output,
        metadata: {
          openai_id: copy.raw.id,
          model: copy.model,
          moderation_id: moderation.moderationId,
          moderation_model: moderation.model,
          template_id: template?.id ?? null,
          template_name: template?.name ?? null
        }
      }
    );

    await recordSuccessfulUsage(user.id, "marketing_generations");
    logger.info("Marketing generation completed", {
      userId: user.id,
      generationId: completedGeneration.id,
      durationMs: Date.now() - startedAt,
      contentType: payload.contentType
    });
    const usage = await getDailyUsage(supabase, user.id);

    return NextResponse.json<MarketingGenerateResponse>(
      { generation: completedGeneration, usage },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Marketing generation failed";

    if (generation) {
      await updateMarketingGeneration(supabase, generation.id, user.id, {
        status: "failed",
        error_message: message
      }).catch(() => null);
    }

    await logCentralizedError(error, {
      category: "generation",
      provider: "openai",
      message,
      userId: user.id,
      requestId: request.headers.get("x-request-id"),
      severity: "critical",
      context: {
        durationMs: Date.now() - startedAt,
        generationId: generation?.id,
        contentType: payload.contentType
      }
    });

    return NextResponse.json<MarketingGenerateResponse>(
      {
        error: message,
        fallback:
          "Generation was safely marked failed. Your quota was not consumed; revise or retry when the provider recovers."
      },
      { status: 500 }
    );
  }
}
