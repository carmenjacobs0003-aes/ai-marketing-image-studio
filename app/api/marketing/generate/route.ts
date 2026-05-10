import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createMarketingGeneration,
  getDailyUsage,
  listBrandKits,
  listProjects,
  type BrandKit,
  type Project
} from "@/lib/db/queries";
import {
  createMarketingCopy,
  getMarketingModelName,
  moderateMarketingInput
} from "@/lib/openai/marketing";
import { marketingContentTypeSchema } from "@/types/marketing";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TypedSupabaseClient } from "@/lib/db/helpers";
import {
  assertCanGenerateMarketing,
  recordSuccessfulUsage
} from "@/lib/usage/limits";

const requestSchema = z.object({
  prompt: z.string().trim().min(10).max(4000),
  contentType: marketingContentTypeSchema.default("complete_marketing_pack"),
  projectId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().optional()
});

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
    };

async function readRequestJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
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

  const entitlement = await assertCanGenerateMarketing(user.id);

  if (!entitlement.allowed) {
    return NextResponse.json<MarketingGenerateResponse>(
      { error: entitlement.reason, usage: entitlement.usage },
      { status: 402 }
    );
  }

  const payload = parsed.data;
  const supabase =
    createSupabaseServerClient() as unknown as TypedSupabaseClient;

  if (payload.projectId) {
    const projects = (await listProjects(supabase, user.id)) as Project[];
    const project = projects.find((item) => item.id === payload.projectId);

    if (!project) {
      return NextResponse.json<MarketingGenerateResponse>(
        { error: "Project not found" },
        { status: 404 }
      );
    }
  }

  let brandContext: { voice: string | null; guidelines: string | null } | null =
    null;

  if (payload.brandKitId) {
    const brandKits = (await listBrandKits(supabase, user.id)) as BrandKit[];
    const brandKit = brandKits.find((item) => item.id === payload.brandKitId);

    if (!brandKit) {
      return NextResponse.json<MarketingGenerateResponse>(
        { error: "Brand kit not found" },
        { status: 404 }
      );
    }

    brandContext = { voice: brandKit.voice, guidelines: brandKit.guidelines };
  }

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

    const copy = await createMarketingCopy({
      prompt: payload.prompt,
      contentType: payload.contentType,
      brandVoice: brandContext?.voice,
      guidelines: brandContext?.guidelines
    });

    const generation = await createMarketingGeneration(supabase, {
      user_id: user.id,
      project_id: payload.projectId ?? null,
      brand_kit_id: payload.brandKitId ?? null,
      prompt: payload.prompt,
      content_type: payload.contentType,
      model: getMarketingModelName(),
      status: "completed",
      output: copy.output,
      metadata: {
        openai_id: copy.raw.id,
        model: copy.model,
        moderation_id: moderation.moderationId,
        moderation_model: moderation.model
      }
    });

    await recordSuccessfulUsage(user.id, "marketing_generations");
    const usage = await getDailyUsage(supabase, user.id);

    return NextResponse.json<MarketingGenerateResponse>(
      { generation, usage },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Marketing generation failed";

    return NextResponse.json<MarketingGenerateResponse>(
      { error: message },
      { status: 500 }
    );
  }
}
