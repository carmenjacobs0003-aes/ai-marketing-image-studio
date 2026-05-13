"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent
} from "react";
import { useSearchParams } from "next/navigation";
import type { BrandKit } from "@/lib/db/queries";
import type { UsageSummary } from "@/lib/usage/limits";

type StudioCanvasProps = {
  brandKits: BrandKit[];
  usage: UsageSummary;
};

type ImageGenerationProvider = "openai" | "pollinations";

type GeneratedImageResponse = {
  id: string;
  prompt: string;
  projectId: string | null;
  signedUrl?: string | null;
  downloadUrl?: string | null;
  storagePath: string;
};

type ImageGenerationApiResponse =
  | ({ success: true } & GeneratedImageResponse)
  | {
      success: false;
      error?: string;
      publicError?: string;
      step?: string;
      debugReason?: string;
      diagnostics?: Record<string, unknown>;
      usage?: UsageSummary;
    };

const PUBLIC_IMAGE_GENERATION_UNAVAILABLE_MESSAGE =
  "Unavailable";
const DEFAULT_OPENAI_MODEL = "gpt-image-1";
const DEFAULT_POLLINATIONS_MODEL = "flux";

function getGenerationErrorMessage(
  status: number,
  message?: string,
  step?: string
) {
  return "Unavailable";
}

async function readGenerationResponse(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as ImageGenerationApiResponse;
  } catch {
    return null;
  }
}

export function StudioCanvas({
  brandKits,
  usage: initialUsage
}: StudioCanvasProps) {
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const [brandKitId, setBrandKitId] = useState("");
  const [provider, setProvider] = useState<ImageGenerationProvider>("openai");
  const [model, setModel] = useState(DEFAULT_OPENAI_MODEL);
  const [size, setSize] = useState("1024x1024");
  const [seed, setSeed] = useState("");
  const [usage, setUsage] = useState(initialUsage);
  const [image, setImage] = useState<GeneratedImageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submissionQueued, setSubmissionQueued] = useState(false);
  const submitInFlightRef = useRef(false);
  const activeGenerationRequestRef = useRef(0);
  const lastSubmitAtRef = useRef(0);
  const signedUrlRefreshInFlightRef = useRef(false);
  const submitDebounceMs = 1000;
  const limitReached = usage.totalGenerations >= usage.monthlyGenerationLimit;

  useEffect(() => {
    return () => {
      activeGenerationRequestRef.current += 1;
    };
  }, []);

  const refreshSignedUrls = useCallback(async (imageId: string) => {
    if (signedUrlRefreshInFlightRef.current) {
      return;
    }

    signedUrlRefreshInFlightRef.current = true;

    try {
      const response = await fetch(`/api/images/${imageId}/signed-url`, {
        method: "POST"
      });
      const payload = (await response.json()) as {
        signedUrl?: string | null;
        downloadUrl?: string | null;
      };

      if (!response.ok || !payload.signedUrl) {
        return;
      }

      setImage((current) =>
        current?.id === imageId
          ? {
              ...current,
              signedUrl: payload.signedUrl ?? current.signedUrl,
              downloadUrl: payload.downloadUrl ?? current.downloadUrl
            }
          : current
      );
    } catch {
      // Keep the completed generation recoverable by retrying when state changes
      // or when the user reloads the library/studio view.
    } finally {
      signedUrlRefreshInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (image?.storagePath && !image.signedUrl) {
      void refreshSignedUrls(image.id);
    }
  }, [image, refreshSignedUrls]);

  async function refreshUsage() {
    const response = await fetch("/api/me/usage", { cache: "no-store" });

    if (response.ok) {
      setUsage(await response.json());
    }
  }

  function isDuplicateSubmission() {
    const now = Date.now();

    if (submitInFlightRef.current) {
      return true;
    }

    if (now - lastSubmitAtRef.current < submitDebounceMs) {
      return true;
    }

    submitInFlightRef.current = true;
    lastSubmitAtRef.current = now;
    return false;
  }

  function onGenerateButtonClick(event: MouseEvent<HTMLButtonElement>) {
    if (submitInFlightRef.current || submissionQueued) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isDuplicateSubmission()) {
      console.info("Duplicate image generation submit ignored", {
        isLoading,
        submissionQueued,
        msSinceLastSubmit: Date.now() - lastSubmitAtRef.current
      });
      return;
    }

    const requestId = activeGenerationRequestRef.current + 1;
    activeGenerationRequestRef.current = requestId;

    setSubmissionQueued(true);
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          brandKitId: brandKitId || undefined,
          provider,
          model: model.trim() || undefined,
          size,
          seed: seed.trim() ? Number(seed) : undefined
        })
      });

      const payload = await readGenerationResponse(response);

      if (!response.ok || !payload || !payload.success) {
        const errorPayload = payload && !payload.success ? payload : null;

        console.error("Image generation API returned an error", {
          status: response.status,
          statusText: response.statusText,
          payload: errorPayload
        });

        if (activeGenerationRequestRef.current !== requestId) return;

        setError("Unavailable");

        if (payload && !payload.success && payload.usage) {
          setUsage(payload.usage);
        }

        return;
      }

      if (activeGenerationRequestRef.current !== requestId) return;

      setImage(payload);
      setPrompt("");
      await refreshUsage();
    } catch (caughtError) {
      if (activeGenerationRequestRef.current !== requestId) return;

      console.error("Image generation submit failed before API JSON response", {
        error:
          caughtError instanceof Error
            ? caughtError.message
            : String(caughtError)
      });

      setError("Unavailable");
    } finally {
      if (activeGenerationRequestRef.current === requestId) {
        submitInFlightRef.current = false;
        setSubmissionQueued(false);
        setIsLoading(false);
      }
    }
  }

  function onProviderChange(nextProvider: ImageGenerationProvider) {
    setProvider(nextProvider);
    setModel(
      nextProvider === "pollinations"
        ? DEFAULT_POLLINATIONS_MODEL
        : DEFAULT_OPENAI_MODEL
    );
  }

  const generateDisabled =
    isLoading ||
    submissionQueued ||
    limitReached ||
    prompt.trim().length < 10 ||
    submitInFlightRef.current;

  return (
    <main className="page-shell grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="glass-card space-y-6 p-6">
        <div>
          <p className="eyebrow">Studio</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Generate an image
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Generate cinematic visual assets from a single prompt. Completed
            images are stored in your private library.
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 shadow-lg shadow-cyan-500/10">
          <p className="text-sm text-cyan-100">
            Monthly pooled usage · {usage.plan}
          </p>

          <p className="mt-1 text-2xl font-black">
            {usage.totalGenerations}/{usage.monthlyGenerationLimit}
          </p>

          <p className="text-xs text-slate-300">
            {usage.remainingGenerations} generations remaining this month. Use
            them in any combination up to {usage.monthlyGenerationLimit} total
            monthly generations.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label
            className="block space-y-2 text-sm font-medium"
            htmlFor="studio-prompt"
          >
            <span>Prompt</span>

            <textarea
              id="studio-prompt"
              name="prompt"
              className="field-control min-h-44"
              disabled={isLoading || limitReached}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the product, lighting, camera style, composition, and background..."
              value={prompt}
            />
          </label>

          <label
            className="block space-y-2 text-sm font-medium"
            htmlFor="studio-brand-kit"
          >
            <span>Brand kit</span>

            <select
              id="studio-brand-kit"
              name="brandKitId"
              className="field-control"
              disabled={isLoading || limitReached}
              onChange={(event) => setBrandKitId(event.target.value)}
              value={brandKitId}
            >
              <option value="">Auto: default brand kit</option>

              {brandKits.map((brandKit) => (
                <option key={brandKit.id} value={brandKit.id}>
                  {brandKit.name}
                  {brandKit.is_default ? " · default" : ""}
                </option>
              ))}
            </select>
          </label>

          <label
            className="block space-y-2 text-sm font-medium"
            htmlFor="studio-provider"
          >
            <span>Provider</span>

            <select
              id="studio-provider"
              name="provider"
              className="field-control"
              disabled={isLoading || limitReached}
              onChange={(event) =>
                onProviderChange(event.target.value as ImageGenerationProvider)
              }
              value={provider}
            >
              <option value="openai">OpenAI</option>
              <option value="pollinations">Pollinations</option>
            </select>
          </label>

          <label
            className="block space-y-2 text-sm font-medium"
            htmlFor="studio-model"
          >
            <span>Model</span>

            <input
              id="studio-model"
              name="model"
              className="field-control"
              disabled={isLoading || limitReached}
              onChange={(event) => setModel(event.target.value)}
              placeholder={
                provider === "pollinations"
                  ? DEFAULT_POLLINATIONS_MODEL
                  : DEFAULT_OPENAI_MODEL
              }
              value={model}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className="block space-y-2 text-sm font-medium"
              htmlFor="studio-size"
            >
              <span>Size</span>

              <select
                id="studio-size"
                name="size"
                className="field-control"
                disabled={isLoading || limitReached}
                onChange={(event) => setSize(event.target.value)}
                value={size}
              >
                <option value="1024x1024">1024 × 1024</option>
                <option value="1024x1792">1024 × 1792</option>
                <option value="1792x1024">1792 × 1024</option>
              </select>
            </label>

            <label
              className="block space-y-2 text-sm font-medium"
              htmlFor="studio-seed"
            >
              <span>Seed</span>

              <input
                id="studio-seed"
                name="seed"
                className="field-control"
                disabled={isLoading || limitReached || provider === "openai"}
                inputMode="numeric"
                min="0"
                onChange={(event) => setSeed(event.target.value)}
                placeholder="Optional"
                type="number"
                value={seed}
              />
            </label>
          </div>

          {error ? (
            <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              Unavailable
            </p>
          ) : null}

          {limitReached ? (
            <p className="rounded-2xl border border-cyan-300/20 bg-black p-3 text-sm text-cyan-100">
              Monthly generation limit reached. Upgrade for more total monthly
              generations.
            </p>
          ) : null}

          <button
            className="neon-button w-full"
            disabled={generateDisabled}
            onClick={onGenerateButtonClick}
            style={{ touchAction: "manipulation" }}
            type="submit"
          >
            {isLoading || submissionQueued ? "Generating..." : "Generate image"}
          </button>
        </form>
      </aside>

      <section className="glass-card p-4 shadow-2xl shadow-cyan-950/20 sm:p-6">
        <div className="flex h-full min-h-[460px] items-center justify-center rounded-2xl border border-dashed border-cyan-300/30 bg-black p-4 text-center text-slate-300">
          {isLoading ? (
            <div className="w-full max-w-xl animate-pulse space-y-4">
              <div className="aspect-square rounded-3xl border border-cyan-300/20 bg-cyan-300/10 shadow-2xl shadow-cyan-500/10" />

              <div className="mx-auto h-4 w-2/3 rounded-full bg-white/10" />

              <div className="mx-auto h-4 w-1/2 rounded-full bg-white/10" />
            </div>
          ) : image?.signedUrl ? (
            <article className="w-full max-w-3xl overflow-hidden rounded-3xl border border-cyan-300/20 bg-black shadow-2xl shadow-cyan-500/20">
              <div className="relative aspect-square max-h-[640px] w-full">
                <Image
                  alt="Generated visual asset"
                  className="object-contain"
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  onError={() => refreshSignedUrls(image.id)}
                  src={image.signedUrl}
                />
              </div>

              <div className="space-y-4 border-t border-white/10 p-4 text-left sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Generation saved
                  </p>

                  <p className="mt-1 line-clamp-2 text-sm text-slate-300">
                    {image.prompt}
                  </p>
                </div>

                {image.downloadUrl ? (
                  <a
                    className="inline-flex w-full justify-center ghost-button px-4 py-2 text-sm sm:w-auto"
                    download
                    href={image.downloadUrl}
                  >
                    Download
                  </a>
                ) : null}
              </div>
            </article>
          ) : image?.storagePath ? (
            <p>Restoring saved preview...</p>
          ) : (
            <p>
              Generated visuals appear here with preview, download, and project
              save options.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
