"use client";

import { useState, type FormEvent } from "react";
import type { UsageSummary } from "@/lib/usage/limits";

type StudioCanvasProps = {
  usage: UsageSummary;
};

type GeneratedImageResponse = {
  id: string;
  signedUrl?: string;
  storagePath: string;
};

export function StudioCanvas({ usage: initialUsage }: StudioCanvasProps) {
  const [prompt, setPrompt] = useState("");
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
        body: JSON.stringify({ prompt })
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
    <main className="grid gap-6 p-4 text-white sm:p-6 lg:grid-cols-[320px_1fr] lg:p-8">
      <aside className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-cyan-950/20">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Studio
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Generate an image
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Protected API generation stores successful outputs in your private
            Supabase bucket.
          </p>
        </div>
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
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
        <form className="space-y-3" onSubmit={onSubmit}>
          <label className="block space-y-2 text-sm font-medium">
            <span>Prompt</span>
            <textarea
              className="min-h-40 w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2"
              disabled={isLoading || limitReached}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe a campaign-ready product image..."
              value={prompt}
            />
          </label>
          {error ? (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}
          {limitReached ? (
            <p className="rounded-xl border border-cyan-300/20 bg-black p-3 text-sm text-cyan-100">
              Daily image limit reached. Upgrade your plan for more capacity.
            </p>
          ) : null}
          <button
            className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading || limitReached || prompt.length < 10}
            type="submit"
          >
            {isLoading ? "Generating..." : "Generate image"}
          </button>
        </form>
      </aside>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
        <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-cyan-300/30 bg-black p-4 text-center text-slate-300">
          {image?.signedUrl ? (
            <img
              alt="Generated marketing asset"
              className="max-h-[640px] rounded-xl object-contain"
              src={image.signedUrl}
            />
          ) : (
            <p>
              {isLoading
                ? "Your image is rendering securely..."
                : "Generated images appear here after successful creation."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
