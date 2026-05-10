"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { BrandKit, MarketingGeneration, Project } from "@/lib/db/queries";
import Link from "next/link";
import { marketingTemplates } from "@/lib/templates/catalog";
import { isPaidPlan } from "@/lib/billing/plans";
import type { UsageSummary } from "@/lib/usage/limits";
import {
  marketingOutputSchema,
  type MarketingContentType,
  type MarketingOutput
} from "@/types/marketing";

type MarketingGeneratorProps = {
  usage: UsageSummary;
  generations: MarketingGeneration[];
  projects: Project[];
  brandKits: BrandKit[];
};

type MarketingGeneratePayload =
  | {
      generation: MarketingGeneration;
    }
  | { error: string; usage?: UsageSummary; categories?: string[] };

const contentTypes: Array<{
  value: MarketingContentType;
  label: string;
  description: string;
}> = [
  {
    value: "complete_marketing_pack",
    label: "Complete marketing pack",
    description: "Social posts, email outreach, and SEO blog content."
  },
  {
    value: "social_media_posts",
    label: "Social media posts",
    description: "Prioritize platform-ready social content."
  },
  {
    value: "email_outreach",
    label: "Email outreach",
    description: "Prioritize subject lines, body copy, and follow-up."
  },
  {
    value: "seo_blog_content",
    label: "SEO blog content",
    description: "Prioritize search-focused blog planning."
  }
];

function formatMarketingOutput(output: MarketingGeneration["output"]) {
  const parsed = marketingOutputSchema.safeParse(output);

  return parsed.success ? parsed.data : null;
}

function MarketingOutputView({ output }: { output: MarketingOutput }) {
  return (
    <div className="mt-4 space-y-4 text-sm leading-6 text-slate-100">
      <section className="rounded-xl border border-cyan-300/20 bg-black p-4">
        <h4 className="font-black text-cyan-300">Campaign summary</h4>
        <p className="mt-2 text-slate-200">{output.campaignSummary}</p>
      </section>
      <section className="rounded-xl border border-white/10 bg-black p-4">
        <h4 className="font-black text-cyan-300">Social media posts</h4>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {output.socialMediaPosts.map((post) => (
            <div
              className="rounded-lg border border-white/10 bg-white/[0.04] p-3 transition hover:border-cyan-300/40"
              key={`${post.platform}-${post.callToAction}`}
            >
              <p className="font-semibold text-white">{post.platform}</p>
              <p className="mt-2 whitespace-pre-wrap text-slate-200">
                {post.post}
              </p>
              <p className="mt-2 font-semibold text-cyan-200">
                CTA: {post.callToAction}
              </p>
              {post.hashtags.length ? (
                <p className="mt-2 text-xs text-slate-400">
                  {post.hashtags.join(" ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-white/10 bg-black p-4">
        <h4 className="font-black text-cyan-300">Email outreach</h4>
        <p className="mt-2 text-cyan-100">
          {output.emailOutreach.subjectLines.join(" • ")}
        </p>
        <p className="mt-2 text-slate-400">
          {output.emailOutreach.previewText}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-slate-200">
          {output.emailOutreach.body}
        </p>
        <p className="mt-3 font-semibold text-cyan-200">
          CTA: {output.emailOutreach.callToAction}
        </p>
        <p className="mt-2 text-slate-300">
          Follow-up: {output.emailOutreach.followUp}
        </p>
      </section>
      <section className="rounded-xl border border-white/10 bg-black p-4">
        <h4 className="font-black text-cyan-300">SEO blog content</h4>
        <p className="mt-2 text-lg font-black text-white">
          {output.seoBlogContent.title}
        </p>
        <p className="text-slate-400">/{output.seoBlogContent.slug}</p>
        <p className="mt-2 text-slate-200">
          {output.seoBlogContent.metaDescription}
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-cyan-200">
          {output.seoBlogContent.keywords.join(" · ")}
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-slate-300">
          {output.seoBlogContent.outline.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 whitespace-pre-wrap text-slate-200">
          {output.seoBlogContent.intro}
        </p>
        <p className="mt-3 font-semibold text-cyan-200">
          CTA: {output.seoBlogContent.callToAction}
        </p>
      </section>
    </div>
  );
}

export function MarketingGenerator({
  usage: initialUsage,
  generations: initialGenerations,
  projects,
  brandKits
}: MarketingGeneratorProps) {
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState<MarketingContentType>(
    "complete_marketing_pack"
  );
  const [projectId, setProjectId] = useState("");
  const [brandKitId, setBrandKitId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [usage, setUsage] = useState(initialUsage);
  const [generations, setGenerations] = useState(initialGenerations);
  const [savingGenerationId, setSavingGenerationId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const limitReached =
    usage.marketingGenerationLimit !== null &&
    usage.marketingGenerations >= usage.marketingGenerationLimit;
  const canUsePremiumTemplates = isPaidPlan(usage.plan);
  const selectedContentType = useMemo(
    () => contentTypes.find((item) => item.value === contentType),
    [contentType]
  );

  async function refreshUsage() {
    const response = await fetch("/api/me/usage", { cache: "no-store" });

    if (response.ok) {
      setUsage(await response.json());
    }
  }

  async function saveGenerationToProject(
    generationId: string,
    nextProjectId: string | null
  ) {
    setSavingGenerationId(generationId);
    setError(null);

    try {
      const response = await fetch(
        `/api/marketing/${generationId}/save-to-project`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: nextProjectId })
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        setError(
          payload.error ?? "Unable to save marketing content to project."
        );
        return;
      }

      setGenerations((current) =>
        current.map((item) =>
          item.id === generationId
            ? { ...item, project_id: payload.projectId }
            : item
        )
      );
      setSuccessMessage("Marketing content project updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save marketing content to project."
      );
    } finally {
      setSavingGenerationId(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          contentType,
          projectId: projectId || undefined,
          brandKitId: brandKitId || undefined,
          templateId: templateId || undefined
        })
      });
      const payload = (await response.json()) as MarketingGeneratePayload;

      if (!response.ok) {
        if ("usage" in payload && payload.usage) {
          setUsage(payload.usage);
        }
        setError(
          "error" in payload
            ? payload.error
            : "Unable to generate marketing content."
        );
        return;
      }

      if ("generation" in payload) {
        setGenerations((current) =>
          [payload.generation, ...current].slice(0, 8)
        );
        setPrompt("");
        setSuccessMessage(
          "Marketing content generated and saved to your project history."
        );
        await refreshUsage();
      }
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate marketing content."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[400px_1fr]">
        <section className="glass-card space-y-6 p-5 sm:p-8">
          <div>
            <p className="eyebrow">
              Marketing
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Generate campaign content
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Create social posts, email outreach, and SEO blog content with
              plan checks, safety moderation, and usage tracking.
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
          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block space-y-2 text-sm font-medium">
              <span>Content focus</span>
              <select
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 focus:border-cyan-300/70 focus:ring-2"
                disabled={isLoading || limitReached}
                onChange={(event) =>
                  setContentType(event.target.value as MarketingContentType)
                }
                value={contentType}
              >
                {contentTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-slate-400">
                {selectedContentType?.description}
              </span>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>Reusable template</span>
              <select
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 focus:border-cyan-300/70 focus:ring-2"
                disabled={isLoading || limitReached}
                onChange={(event) => {
                  const selected = marketingTemplates.find(
                    (template) => template.id === event.target.value
                  );
                  setTemplateId(event.target.value);
                  if (
                    selected &&
                    (!selected.premium || canUsePremiumTemplates)
                  ) {
                    setContentType(selected.contentType);
                  }
                }}
                value={templateId}
              >
                <option value="">No template</option>
                {marketingTemplates.map((template) => {
                  const locked = Boolean(
                    template.premium && !canUsePremiumTemplates
                  );

                  return (
                    <option
                      disabled={locked}
                      key={template.id}
                      value={template.id}
                    >
                      {template.name} · {template.category}
                      {template.premium ? " · premium" : ""}
                      {locked ? " · upgrade required" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            {!canUsePremiumTemplates ? (
              <p className="rounded-xl border border-cyan-300/20 bg-black p-3 text-xs text-cyan-100">
                Premium templates are locked on Free.{" "}
                <Link className="font-semibold underline" href="/pricing">
                  Upgrade to Pro or Agency
                </Link>
                .
              </p>
            ) : null}
            <label className="block space-y-2 text-sm font-medium">
              <span>Save to project</span>
              <select
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 focus:border-cyan-300/70 focus:ring-2"
                disabled={isLoading || limitReached}
                onChange={(event) => setProjectId(event.target.value)}
                value={projectId}
              >
                <option value="">Marketing library only</option>
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
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 focus:border-cyan-300/70 focus:ring-2"
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
            <label className="block space-y-2 text-sm font-medium">
              <span>Brief</span>
              <textarea
                className="min-h-44 w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2"
                disabled={isLoading || limitReached}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe your audience, offer, product, goal, keywords, and desired tone..."
                value={prompt}
              />
            </label>
            {error ? (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </p>
            ) : null}
            {successMessage ? (
              <p className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-100">
                {successMessage}
              </p>
            ) : null}
            {limitReached ? (
              <p className="rounded-xl border border-cyan-300/20 bg-black p-3 text-sm text-cyan-100">
                Daily marketing limit reached. Upgrade your plan for more
                capacity.
              </p>
            ) : null}
            <button
              className="neon-button w-full"
              disabled={isLoading || limitReached || prompt.trim().length < 10}
              type="submit"
            >
              {isLoading ? "Generating and saving..." : "Generate marketing"}
            </button>
          </form>
        </section>
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
                Library
              </p>
              <h2 className="text-2xl font-black sm:text-3xl">
                Recent marketing generations
              </h2>
            </div>
            {isLoading ? (
              <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
                OpenAI is writing your content...
              </div>
            ) : null}
          </div>
          {generations.length ? (
            generations.map((generation) => {
              const output = formatMarketingOutput(generation.output);

              return (
                <article
                  className="glass-card p-4 shadow-xl shadow-black/20 sm:p-5"
                  key={generation.id}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-black capitalize text-cyan-300">
                      {generation.content_type.replaceAll("_", " ")}
                    </h3>
                    <p className="text-xs capitalize text-slate-400">
                      {generation.status} ·{" "}
                      {new Date(generation.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">
                    {generation.prompt}
                  </p>
                  <label className="mt-4 block space-y-2 text-sm">
                    <span className="text-slate-300">
                      Save content to project
                    </span>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-white outline-none ring-cyan-300 transition focus:border-cyan-300/80 focus:ring-2"
                      disabled={savingGenerationId === generation.id}
                      onChange={(event) =>
                        saveGenerationToProject(
                          generation.id,
                          event.target.value || null
                        )
                      }
                      value={generation.project_id ?? ""}
                    >
                      <option value="">Marketing library only</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {output ? (
                    <MarketingOutputView output={output} />
                  ) : (
                    <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black p-4 text-sm leading-6 text-white">
                      {JSON.stringify(generation.output, null, 2)}
                    </pre>
                  )}
                </article>
              );
            })
          ) : (
            <p className="empty-state">
              No marketing generations yet. Add a brief to create your first
              social, email, and SEO pack.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
