"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { BrandKit, MarketingGeneration, Project } from "@/lib/db/queries";
import Link from "next/link";
import { marketingTemplates } from "@/lib/templates/catalog";
import { isPaidPlan } from "@/lib/billing/plans";
import { PublishGalleryButton } from "@/components/gallery/publish-gallery-button";
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
      usage?: UsageSummary;
    }
  | {
      error: string;
      usage?: UsageSummary;
      categories?: string[];
      fallback?: string;
      cooldownSeconds?: number;
    };

const GENERATION_DEBOUNCE_MS = 1200;
const DEFAULT_ERROR_COOLDOWN_MS = 8000;

function getFriendlyMarketingError(message?: string, status?: number) {
  const normalized = (message ?? "").toLowerCase();

  if (
    status === 429 ||
    /429|rate limit|too many requests|too many/i.test(message ?? "")
  ) {
    return "Generation queue is temporarily busy. Please retry in a moment.";
  }

  if (
    /moderation|safety review|blocked by safety|triggered the safety/i.test(
      message ?? ""
    )
  ) {
    return "Your brief needs a quick revision before we can generate it. Adjust any sensitive claims or restricted content, then try again.";
  }

  if (/timeout|timed out/.test(normalized)) {
    return "Generation is taking longer than expected. Your quota was not consumed; please retry in a moment.";
  }

  if (/quota|limit reached|monthly generation limit/.test(normalized)) {
    return (
      message ??
      "Monthly generation limit reached. Upgrade for more total monthly generations."
    );
  }

  if (/invalid marketing generation request/.test(normalized)) {
    return "Add a campaign brief with at least 10 characters before generating.";
  }

  return message && !/openai|json|provider|stack|exception/i.test(message)
    ? message
    : "We couldn’t complete this generation. Please retry in a moment or simplify the brief.";
}

function getRetryGuidance(message: string) {
  if (/capacity|busy|retry in a moment/i.test(message)) {
    return "Tip: wait a few seconds before retrying. Repeated taps can slow the queue.";
  }

  if (/revision|brief/i.test(message)) {
    return "Tip: keep the offer clear, remove sensitive or unsafe phrasing, and submit again after the short cooldown.";
  }

  return "Tip: your draft and quota are safe. You can retry once the button is available.";
}

const contentTypes: Array<{
  value: MarketingContentType;
  label: string;
  description: string;
}> = [
  {
    value: "complete_marketing_pack",
    label: "Complete campaign pack",
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
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
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
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lastSubmitAtRef = useRef(0);
  const limitReached = usage.totalGenerations >= usage.monthlyGenerationLimit;
  const canUsePremiumTemplates = isPaidPlan(usage.plan);
  const selectedContentType = useMemo(
    () => contentTypes.find((item) => item.value === contentType),
    [contentType]
  );
  const cooldownRemainingSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
    : 0;
  const isSubmitDisabled =
    isLoading ||
    limitReached ||
    prompt.trim().length < 10 ||
    cooldownRemainingSeconds > 0;

  useEffect(() => {
    if (!cooldownUntil) return;

    const timer = window.setInterval(() => setNow(Date.now()), 250);

    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    if (cooldownUntil && cooldownUntil <= now) {
      setCooldownUntil(null);
    }
  }, [cooldownUntil, now]);

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
          getFriendlyMarketingError(
            payload.error ?? "Unable to save marketing content to project.",
            response.status
          )
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
      setSuccessMessage("Campaign content project updated.");
    } catch (saveError) {
      setError(
        getFriendlyMarketingError(
          saveError instanceof Error
            ? saveError.message
            : "Unable to save marketing content to project."
        )
      );
    } finally {
      setSavingGenerationId(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submittedAt = Date.now();
    if (
      isSubmitDisabled ||
      submittedAt - lastSubmitAtRef.current < GENERATION_DEBOUNCE_MS
    ) {
      return;
    }
    lastSubmitAtRef.current = submittedAt;
    setNow(submittedAt);
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
        const friendlyError = getFriendlyMarketingError(
          "error" in payload
            ? payload.error
            : "Unable to generate marketing content.",
          response.status
        );
        setError(friendlyError);
        const nextCooldownSeconds =
          "cooldownSeconds" in payload && payload.cooldownSeconds
            ? payload.cooldownSeconds
            : response.status === 429 ||
                /revision|capacity|busy/i.test(friendlyError)
              ? DEFAULT_ERROR_COOLDOWN_MS / 1000
              : 0;
        if (nextCooldownSeconds > 0) {
          setCooldownUntil(Date.now() + nextCooldownSeconds * 1000);
        }
        return;
      }

      if ("generation" in payload) {
        setGenerations((current) =>
          [payload.generation, ...current].slice(0, 8)
        );
        setPrompt("");
        setSuccessMessage(
          "Campaign content generated and saved to your library."
        );
        if (payload.usage) {
          setUsage(payload.usage);
        } else {
          await refreshUsage();
        }
      }
    } catch (generationError) {
      setError(
        getFriendlyMarketingError(
          generationError instanceof Error
            ? generationError.message
            : "Unable to generate marketing content."
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[minmax(360px,440px)_1fr] xl:items-start">
        <section className="glass-card space-y-8 p-5 shadow-[0_0_50px_rgba(34,211,238,0.08)] sm:p-7 xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-y-auto xl:p-8">
          <div>
            <p className="eyebrow">Marketing</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Generate campaign assets
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Create social posts, email outreach, and SEO content from a
              focused brief.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
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
          <form className="space-y-5" onSubmit={onSubmit}>
            <label className="block space-y-2 text-sm font-medium">
              <span>Content focus</span>
              <select
                className="field-control"
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
                className="field-control"
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
                      {template.premium ? " · advanced" : ""}
                      {locked ? " · upgrade required" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            {!canUsePremiumTemplates ? (
              <p className="rounded-xl border border-cyan-300/20 bg-black p-3 text-xs text-cyan-100">
                Advanced templates are locked on Free.{" "}
                <Link className="font-semibold underline" href="/pricing">
                  Unlock Pro or Agency
                </Link>
                .
              </p>
            ) : null}
            <label className="block space-y-2 text-sm font-medium">
              <span>Save to project</span>
              <select
                className="field-control"
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
            <label className="block space-y-2 text-sm font-medium">
              <span>Brief</span>
              <textarea
                className="field-control min-h-52 resize-y leading-6"
                disabled={isLoading || limitReached}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe your audience, offer, product, goal, keywords, and desired tone..."
                value={prompt}
              />
            </label>
            {error ? (
              <div
                className="rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100 shadow-[0_0_30px_rgba(248,113,113,0.08)]"
                role="alert"
              >
                <p className="font-black text-white">Generation paused</p>
                <p className="mt-1 leading-6">{error}</p>
                <p className="mt-2 text-xs leading-5 text-red-100/80">
                  {getRetryGuidance(error)}
                </p>
              </div>
            ) : null}
            {successMessage ? (
              <div
                className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.08)]"
                role="status"
              >
                <p className="font-black text-white">Generation complete</p>
                <p className="mt-1 leading-6">{successMessage}</p>
              </div>
            ) : null}
            {limitReached ? (
              <p className="rounded-xl border border-cyan-300/20 bg-black p-3 text-sm text-cyan-100">
                Monthly generation limit reached. Upgrade for more total monthly
                generations.
              </p>
            ) : null}
            {isLoading ? (
              <div
                className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100"
                role="status"
              >
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 animate-ping rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.9)]" />
                  <span className="font-semibold">
                    Generating your campaign pack…
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  SYNTRIX AI is checking the brief, applying brand context, and
                  saving the finished content.
                </p>
              </div>
            ) : null}
            <div className="pt-1">
              <button
                className="neon-button flex w-full items-center justify-center gap-3 py-3 text-center disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitDisabled}
                type="submit"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                    Generating…
                  </>
                ) : cooldownRemainingSeconds > 0 ? (
                  `Retry in ${cooldownRemainingSeconds}s`
                ) : (
                  "Generate content"
                )}
              </button>
            </div>
          </form>
        </section>
        <section className="space-y-6">
          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
                Library
              </p>
              <h2 className="text-2xl font-black sm:text-3xl">
                Recent campaign generations
              </h2>
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                Writing your content…
              </div>
            ) : null}
          </div>
          {generations.length ? (
            generations.map((generation) => {
              const output = formatMarketingOutput(generation.output);

              return (
                <article
                  className="glass-card p-5 shadow-xl shadow-black/20 sm:p-6"
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
                  <div className="mt-4">
                    <PublishGalleryButton
                      defaultPrompt={generation.prompt}
                      defaultTitle={`${generation.content_type.replaceAll("_", " ")} · ${generation.prompt}`}
                      kind="marketing"
                      sourceId={generation.id}
                    />
                  </div>
                  <label className="mt-4 block space-y-2 text-sm">
                    <span className="text-slate-300">
                      Save content to project
                    </span>
                    <select
                      className="field-control py-2"
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
              No generated campaigns available. Add a brief to create a social,
              email, and SEO pack.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
