"use client";

import { useState, type FormEvent } from "react";
import type { BrandKit, Project } from "@/lib/db/queries";
import type { UsageSummary } from "@/lib/usage/limits";

type StudioCanvasProps = {
  projects: Project[];
  brandKits: BrandKit[];
  usage: UsageSummary;
};

type GeneratedImageResponse = {
  id: string;
  prompt: string;
  projectId: string | null;
  signedUrl?: string;
  downloadUrl?: string;
  storagePath: string;
};

export function StudioCanvas({
  projects,
  brandKits,
  usage: initialUsage
}: StudioCanvasProps) {
  const [prompt, setPrompt] = useState("");
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
    const response = await fetch("/api/me/usage", { cache: "no-store" });

    if (response.ok) {
      setUsage(await response.json());
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
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Unable to generate image.");
        if (payload.usage) {
          setUsage(payload.usage);
        }
        return;
      }

      setImage(payload);
      setPrompt("");
      await refreshUsage();
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate image."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="grid gap-6 p-4 text-white sm:p-6 lg:grid-cols-[360px_1fr] lg:p-8">
      <aside className="space-y-6 rounded-3xl border border-cyan-300/20 bg-black/80 p-6 shadow-2xl shadow-cyan-500/10 ring-1 ring-white/10 backdrop-blur">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Studio
          </p>
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
              className="min-h-44 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 transition placeholder:text-slate-500 hover:border-cyan-300/40 hover:shadow-lg hover:shadow-cyan-500/10 focus:border-cyan-300/80 focus:ring-2"
              disabled={isLoading || limitReached}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe a campaign-ready product image with lighting, style, layout, and background..."
              value={prompt}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Save to project</span>
            <select
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none ring-cyan-300 transition hover:border-cyan-300/40 hover:shadow-lg hover:shadow-cyan-500/10 focus:border-cyan-300/80 focus:ring-2"
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
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none ring-cyan-300 transition hover:border-cyan-300/40 hover:shadow-lg hover:shadow-cyan-500/10 focus:border-cyan-300/80 focus:ring-2"
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
            className="w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 hover:shadow-[0_0_28px_rgba(103,232,249,0.55)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none"
            disabled={isLoading || limitReached || prompt.trim().length < 10}
            type="submit"
          >
            {isLoading ? "Generating..." : "Generate image"}
          </button>
        </form>
      </aside>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-cyan-950/20 sm:p-6">
        <div className="flex h-full min-h-[460px] items-center justify-center rounded-2xl border border-dashed border-cyan-300/30 bg-black p-4 text-center text-slate-300">
          {isLoading ? (
            <div className="w-full max-w-xl animate-pulse space-y-4">
              <div className="aspect-square rounded-3xl border border-cyan-300/20 bg-cyan-300/10 shadow-2xl shadow-cyan-500/10" />
              <div className="mx-auto h-4 w-2/3 rounded-full bg-white/10" />
              <div className="mx-auto h-4 w-1/2 rounded-full bg-white/10" />
            </div>
          ) : image?.signedUrl ? (
            <article className="w-full max-w-3xl overflow-hidden rounded-3xl border border-cyan-300/20 bg-black shadow-2xl shadow-cyan-500/20">
              <img
                alt="Generated marketing asset"
                className="max-h-[640px] w-full object-contain"
                src={image.signedUrl}
              />
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
                    className="inline-flex w-full justify-center rounded-xl border border-cyan-300/40 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300 hover:text-slate-950 hover:shadow-[0_0_22px_rgba(103,232,249,0.5)] sm:w-auto"
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
