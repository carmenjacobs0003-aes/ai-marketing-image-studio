"use client";

import { useState, type FormEvent } from "react";
import type { MarketingGeneration } from "@/lib/db/queries";
import { stringifyMarketingOutput } from "@/lib/db/queries";
import type { UsageSummary } from "@/lib/usage/limits";

type MarketingGeneratorProps = {
  usage: UsageSummary;
  generations: MarketingGeneration[];
};

export function MarketingGenerator({
  usage: initialUsage,
  generations: initialGenerations
}: MarketingGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState("campaign");
  const [usage, setUsage] = useState(initialUsage);
  const [generations, setGenerations] = useState(initialGenerations);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const limitReached =
    usage.marketingGenerationLimit !== null &&
    usage.marketingGenerations >= usage.marketingGenerationLimit;

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
      const response = await fetch("/api/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, contentType })
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Unable to generate marketing copy.");
        if (payload.usage) {
          setUsage(payload.usage);
        }
        return;
      }

      setGenerations((current) => [payload.generation, ...current].slice(0, 8));
      setPrompt("");
      await refreshUsage();
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate marketing copy."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Marketing
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Generate campaign copy
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Daily limits are checked before generation and only successful
              generations count.
            </p>
          </div>
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
            <p className="text-sm text-cyan-100">
              Daily marketing usage · {usage.plan}
            </p>
            <p className="mt-1 text-2xl font-black">
              {usage.marketingGenerations}/
              {usage.marketingGenerationLimit ?? "Fair use"}
            </p>
            <p className="text-xs text-slate-300">
              {usage.remainingMarketingGenerations === null
                ? "Agency fair use included"
                : `${usage.remainingMarketingGenerations} generations remaining today`}
            </p>
          </div>
          <form className="space-y-3" onSubmit={onSubmit}>
            <label className="block space-y-2 text-sm font-medium">
              <span>Content type</span>
              <select
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 focus:border-cyan-300/70 focus:ring-2"
                disabled={isLoading || limitReached}
                onChange={(event) => setContentType(event.target.value)}
                value={contentType}
              >
                <option value="campaign">Campaign</option>
                <option value="social">Social post</option>
                <option value="email">Email</option>
                <option value="ad">Ad creative</option>
              </select>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>Brief</span>
              <textarea
                className="min-h-40 w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2"
                disabled={isLoading || limitReached}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe your audience, offer, product, and desired tone..."
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
                Daily marketing limit reached. Upgrade your plan for more
                capacity.
              </p>
            ) : null}
            <button
              className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading || limitReached || prompt.length < 10}
              type="submit"
            >
              {isLoading ? "Generating..." : "Generate copy"}
            </button>
          </form>
        </section>
        <section className="space-y-4">
          <h2 className="text-2xl font-black">Recent marketing generations</h2>
          {generations.length ? (
            generations.map((generation) => (
              <article
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                key={generation.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-black capitalize text-cyan-300">
                    {generation.content_type}
                  </h3>
                  <p className="text-xs capitalize text-slate-400">
                    {generation.status} ·{" "}
                    {new Date(generation.created_at).toLocaleString()}
                  </p>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  {generation.prompt}
                </p>
                <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-white/10 bg-black p-4 text-sm leading-6 text-white">
                  {stringifyMarketingOutput(generation.output)}
                </pre>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-slate-300">
              No marketing generations yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
