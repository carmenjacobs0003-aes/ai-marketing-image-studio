import { NextResponse } from "next/server";
import { ApiTimeoutError, withTimeout } from "@/lib/api/timeout";
import { getCurrentUser } from "@/lib/auth/session";
import {
  env,
  getDeploymentEnvironmentDiagnostics,
  OPENAI_API_KEY_ENV_VAR_NAME
} from "@/lib/env";
import { logger } from "@/lib/logger";
import { createOpenAIClient } from "@/lib/openai/client";
import {
  getOpenAIDebugReason,
  getOpenAIErrorDiagnostics,
  isSupportedImageModel
} from "@/lib/openai/images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TestOpenAIResponse =
  | {
      success: true;
      apiKeyValid: true;
      modelAccessible: true;
      connectionWorking: true;
      model: string;
      status: number;
      requestId: string | null | undefined;
      details: {
        hasOpenAIKey: boolean;
        runtimeHasOpenAIKey: boolean;
        supportedImageModel: boolean;
        modelOwner: string | null;
      };
    }
  | {
      success: false;
      error: string;
      debugReason: string;
      apiKeyValid: boolean;
      modelAccessible: boolean;
      connectionWorking: boolean;
      model: string;
      status?: number;
      requestId?: string;
      details: {
        hasOpenAIKey: boolean;
        runtimeHasOpenAIKey: boolean;
        supportedImageModel: boolean;
        isAuthOrPermissionIssue?: boolean;
        isQuotaOrBillingIssue?: boolean;
        timedOut?: boolean;
      };
    };

function getRequestLogContext() {
  return {
    route: "/api/test-openai",
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    vercelEnv: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    vercelRegion: process.env.VERCEL_REGION ?? "local"
  };
}

function sanitizeErrorMessage(message: string) {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted_openai_key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted_token]");
}

function getErrorMessage(error: unknown) {
  return sanitizeErrorMessage(
    error instanceof Error
      ? error.message
      : String(error || "OpenAI test failed.")
  );
}

export async function GET() {
  const startedAt = Date.now();
  const model = env.OPENAI_IMAGE_MODEL;
  const hasOpenAIKey = Boolean(env.OPENAI_API_KEY);
  const runtimeHasOpenAIKey = Boolean(process.env[OPENAI_API_KEY_ENV_VAR_NAME]);
  const supportedImageModel = isSupportedImageModel(model);

  logger.info("OpenAI test endpoint started", {
    ...getRequestLogContext(),
    model,
    hasOpenAIKey,
    runtimeHasOpenAIKey,
    supportedImageModel,
    deploymentEnvironment: getDeploymentEnvironmentDiagnostics(process.env, env)
  });

  const user = await getCurrentUser();

  if (!user) {
    const body: TestOpenAIResponse = {
      success: false,
      error: "Unauthorized",
      debugReason: "unauthorized",
      apiKeyValid: false,
      modelAccessible: false,
      connectionWorking: false,
      model,
      details: {
        hasOpenAIKey,
        runtimeHasOpenAIKey,
        supportedImageModel
      }
    };
    logger.warn("OpenAI test endpoint rejected unauthenticated request", {
      ...getRequestLogContext(),
      durationMs: Date.now() - startedAt
    });
    return NextResponse.json<TestOpenAIResponse>(body, { status: 401 });
  }

  if (!hasOpenAIKey) {
    const body: TestOpenAIResponse = {
      success: false,
      error: `${OPENAI_API_KEY_ENV_VAR_NAME} is missing server-side`,
      debugReason: "missing_openai_api_key",
      apiKeyValid: false,
      modelAccessible: false,
      connectionWorking: false,
      model,
      details: {
        hasOpenAIKey,
        runtimeHasOpenAIKey,
        supportedImageModel
      }
    };
    logger.error("OpenAI test endpoint missing API key", {
      ...getRequestLogContext(),
      userId: user.id,
      durationMs: Date.now() - startedAt,
      hasOpenAIKey,
      runtimeHasOpenAIKey
    });
    return NextResponse.json<TestOpenAIResponse>(body, { status: 503 });
  }

  if (!supportedImageModel) {
    const body: TestOpenAIResponse = {
      success: false,
      error: `Unsupported OpenAI image model: ${model}`,
      debugReason: "unsupported_openai_image_model",
      apiKeyValid: true,
      modelAccessible: false,
      connectionWorking: false,
      model,
      details: {
        hasOpenAIKey,
        runtimeHasOpenAIKey,
        supportedImageModel
      }
    };
    logger.error("OpenAI test endpoint unsupported model", {
      ...getRequestLogContext(),
      userId: user.id,
      durationMs: Date.now() - startedAt,
      model
    });
    return NextResponse.json<TestOpenAIResponse>(body, { status: 503 });
  }

  try {
    const openai = createOpenAIClient();
    logger.info("OpenAI test endpoint model retrieve request start", {
      ...getRequestLogContext(),
      userId: user.id,
      model,
      endpoint: `GET /v1/models/${model}`,
      sdkMethod: "openai.models.retrieve",
      hasOpenAIKey,
      runtimeHasOpenAIKey
    });

    const {
      data,
      response,
      request_id: requestId
    } = await withTimeout(
      openai.models.retrieve(model).withResponse(),
      env.API_TIMEOUT_SECONDS * 1000
    );

    logger.info("OpenAI test endpoint model retrieve response", {
      ...getRequestLogContext(),
      userId: user.id,
      model,
      status: response.status,
      ok: response.ok,
      requestId,
      modelOwner: data.owned_by,
      durationMs: Date.now() - startedAt
    });

    return NextResponse.json<TestOpenAIResponse>({
      success: true,
      apiKeyValid: true,
      modelAccessible: true,
      connectionWorking: true,
      model,
      status: response.status,
      requestId,
      details: {
        hasOpenAIKey,
        runtimeHasOpenAIKey,
        supportedImageModel,
        modelOwner: data.owned_by ?? null
      }
    });
  } catch (error) {
    const diagnostics = getOpenAIErrorDiagnostics(error);
    const debugReason =
      error instanceof ApiTimeoutError
        ? "openai_request_timed_out"
        : getOpenAIDebugReason(error);
    const timedOut =
      error instanceof ApiTimeoutError ||
      /timeout|timed out/i.test(getErrorMessage(error));
    const status = timedOut
      ? 504
      : diagnostics.status && diagnostics.status >= 400
        ? diagnostics.status
        : 502;
    const apiKeyValid =
      !diagnostics.isAuthOrPermissionIssue || diagnostics.status !== 401;
    const modelAccessible = !(
      diagnostics.status === 403 ||
      debugReason === "openai_model_access_or_permission_denied"
    );

    logger.error("OpenAI test endpoint failed", {
      ...getRequestLogContext(),
      userId: user.id,
      model,
      durationMs: Date.now() - startedAt,
      exactErrorMessage: error instanceof Error ? error.message : String(error),
      debugReason,
      status: diagnostics.status,
      requestId: diagnostics.requestId,
      isAuthOrPermissionIssue: diagnostics.isAuthOrPermissionIssue,
      isQuotaOrBillingIssue: diagnostics.isQuotaOrBillingIssue,
      timedOut,
      diagnostics
    });

    return NextResponse.json<TestOpenAIResponse>(
      {
        success: false,
        error: getErrorMessage(error),
        debugReason,
        apiKeyValid,
        modelAccessible,
        connectionWorking: false,
        model,
        status: diagnostics.status,
        requestId: diagnostics.requestId,
        details: {
          hasOpenAIKey,
          runtimeHasOpenAIKey,
          supportedImageModel,
          isAuthOrPermissionIssue: diagnostics.isAuthOrPermissionIssue,
          isQuotaOrBillingIssue: diagnostics.isQuotaOrBillingIssue,
          timedOut
        }
      },
      { status }
    );
  }
}
