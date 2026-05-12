"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { BrandKit, Project } from "@/lib/db/queries";
import type { UsageSummary } from "@/lib/usage/limits";

type StudioCanvasProps = {
  projects: Project[];
  brandKits: BrandKit[];
  usage: UsageSummary;
};

type GeneratedImageResponse = {
  success?: true;
  id: string;
  prompt: string;
  projectId: string | null;
  signedUrl?: string;
  downloadUrl?: string;
  storagePath: string;
};

type ErrorResponse = {
  success?: false;
  error?: string;
  usage?: UsageSummary;
};

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  const text = await response.text().catch(() => "");

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error("Failed to parse image generation response", {
      status: response.status,
      bodyPreview: text.slice(0, 500),
      error
    });
    return null;
  }
}

function getGenerationErrorMessage(
  response: Response,
  payload: ErrorResponse | null
) {
  if (payload?.error) {
    return payload.error;
  }

  if (response.status === 504) {
    return "Image generation timed out. Please try again in a moment.";
  }

  if (response.status >= 500) {
    return "Image generation is temporarily unavailable. Please try again soon.";
  }

  return "Unable to generate image. Please review your prompt and try again.";
}

export function StudioCanvas({
  projects,
  brandKits,
  usage: initialUsage
}: StudioCanvasProps) {
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const [projectId, setProjectId] = useState("");
  const [brandKitId, setBrandKitId] = useState("");
  const [usage, setUsage] = useState(initialUsage);
  const [image, setImage] = useState<GeneratedImageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const limitReached =
    usage.imageGenerationLimit !== null &&
    usage.imageGenerations >= usage.imageGenerationLimit;

  async function refreshUsage() {
    try {
      const response = await fetch("/api/me/usage", { cache: "no-store" });

      if (response.ok) {
        const payload = await parseJsonSafely<UsageSummary>(response);

        if (payload) {
          setUsage(payload);
        }
      }
    } catch (usageError) {
      console.error("Unable to refresh image generation usage", usageError);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          projectId: projectId || undefined,
          brandKitId: brandKitId || undefined
        })
      });
      const payload = await parseJsonSafely<
        GeneratedImageResponse | ErrorResponse
      >(response);

      if (!response.ok) {
        const errorPayload = payload as ErrorResponse | null;

        setError(getGenerationErrorMessage(response, errorPayload));
        if (errorPayload?.usage) {
          setUsage(errorPayload.usage);
        }
        return;
      }

      if (!payload || !("id" in payload) || !payload.signedUrl) {
        setError(
          "Image generation finished, but the server returned an incomplete response. Please try again."
        );
        return;
      }

      setImage(payload);
      setPrompt("");
      await refreshUsage();
    } catch (generationError) {
      console.error("Image generation request failed", generationError);
      setError(
        "We could not reach the image generation service. Please check your connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-shell grid gap-6 lg:grid-cols-[360px_1fr]">
      <aside className="glass-card space-y-6 p-6">
        <div>
          <p className="eyebrow">Studio</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Generate an image
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Moderated DALL·E generations are stored permanently in your private
            Supabase image library after successful creation.
          </p>
        </div>
        <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 shadow-lg shadow-cyan-500/10">
          <p className="text-sm text-cyan-100">
            Daily image usage · {usage.plan}
          </p>
          <p className="mt-1 text-2xl font-black">
            {usage.imageGenerations}/{usage.imageGenerationLimit ?? "Fair use"}
          </p>
          <p className="text-xs text-slate-300">
            {usage.remainingImageGenerations === null
              ? "Agency fair use included"
              : `${usage.remainingImageGenerations} generations remaining today`}
          </p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-2 text-sm font-medium">
            <span>Prompt</span>
            <textarea
              className="field-control min-h-44"
              disabled={isLoading || limitReached}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe a campaign-ready product image with lighting, style, layout, and background..."
              value={prompt}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Save to project</span>
            <select
              className="field-control"
              disabled={isLoading || limitReached}
              onChange={(event) => setProjectId(event.target.value)}
              value={projectId}
            >
              <option value="">Image library only</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Brand kit</span>
            <select
              className="field-control"
              disabled={isLoading || limitReached}
              onChange={(event) => setBrandKitId(event.target.value)}
              value={brandKitId}
            >
              <option value="">Auto: project/default brand kit</option>
              {brandKits.map((brandKit) => (
                <option key={brandKit.id} value={brandKit.id}>
                  {brandKit.name}
                  {brandKit.is_default ? " · default" : ""}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <p className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          {limitReached ? (
            <p className="rounded-2xl border border-cyan-300/20 bg-black p-3 text-sm text-cyan-100">
              Daily image limit reached. Upgrade your plan for more capacity.
            </p>
          ) : null}
          <button
            className="neon-button w-full"
            disabled={isLoading || limitReached || prompt.trim().length < 10}
            type="submit"
          >
            {isLoading ? "Generating..." : "Generate image"}
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
                  alt="Generated marketing asset"
                  className="object-contain"
                  fill
                  sizes="(min-width: 1024px) 60vw, 100vw"
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
          ) : (
            <p>
              Generated images appear here after successful creation with a
              preview card, download link, and project save state.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
