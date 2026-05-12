import Link from "next/link";
import { ArrowRight, ImageIcon, Megaphone, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  countProjects,
  getProfile,
  listBrandKits,
  listImageGenerations,
  listMarketingGenerations
} from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/usage/limits";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const supabase = createSupabaseServerClient();
  const [
    usage,
    profile,
    projectCount,
    brandKits,
    imageGenerations,
    marketingGenerations
  ] = await Promise.all([
    getUsageSummary(user.id),
    getProfile(supabase, user.id),
    countProjects(supabase, user.id),
    listBrandKits(supabase, user.id),
    listImageGenerations(supabase, user.id, 5),
    listMarketingGenerations(supabase, user.id, 5)
  ]);

  const quickActions = [
    {
      href: "/studio",
      title: "Generate visuals",
      body: "Create cinematic campaign imagery with brand-aware prompts.",
      icon: ImageIcon
    },
    {
      href: "/marketing",
      title: "Generate content",
      body: "Generate social, email, and SEO content from one focused brief.",
      icon: Megaphone
    },
    {
      href: "/templates",
      title: "Browse templates",
      body: "Start from reusable campaign frameworks.",
      icon: Sparkles
    }
  ];

  return (
    <main className="page-shell">
      <div className="page-container max-w-7xl">
        <header className="page-hero md:p-8">
          <div className="neon-orb -right-16 top-6 h-56 w-56" />
          <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="eyebrow">Workspace overview</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
                Your generation workspace is online.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Signed in as {user.email}. Monitor usage, open generators, and
                manage visuals, brand kits, templates, and billing from one
                private workspace.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link className="neon-button" href="/studio">
                  Open Studio <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link className="ghost-button" href="/billing">
                  Unlock higher limits
                </Link>
              </div>
            </div>
            <div className="holo-panel">
              <p className="eyebrow">Plan status</p>
              <p className="mt-3 text-5xl font-black capitalize text-cyan-300 drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]">
                {usage.plan}
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Your plan controls generation limits, template access, and
                billing status.
              </p>
            </div>
          </div>
        </header>

        <OnboardingFlow
          hasBrandKits={brandKits.length > 0}
          hasGenerations={
            imageGenerations.length + marketingGenerations.length > 0
          }
          hasProjects={projectCount > 0}
          profileComplete={Boolean(profile?.full_name)}
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <article className="metric-card">
            <p className="text-sm text-slate-300">Daily images</p>
            <p className="mt-2 text-3xl font-black">
              {usage.imageGenerations}/{usage.imageGenerationLimit ?? "∞"}
            </p>
          </article>
          <article className="metric-card">
            <p className="text-sm text-slate-300">Daily marketing</p>
            <p className="mt-2 text-3xl font-black">
              {usage.marketingGenerations}/
              {usage.marketingGenerationLimit ?? "∞"}
            </p>
          </article>
          <article className="metric-card">
            <p className="text-sm text-slate-300">Projects</p>
            <p className="mt-2 text-3xl font-black">{projectCount}</p>
          </article>
          <article className="metric-card md:col-span-2">
            <p className="text-sm text-slate-300">Plan access</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="premium-badge">Higher limits available</span>
              <Link
                className="text-sm font-semibold text-cyan-200 hover:text-white"
                href="/billing"
              >
                Manage plan →
              </Link>
            </div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                className="glass-card glass-hover p-5"
                href={action.href}
                key={action.href}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-glow">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-xl font-black">{action.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {action.body}
                </p>
              </Link>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-black">Recent images</h2>
              <Link
                className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                href="/images"
              >
                View images
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {imageGenerations.length ? (
                imageGenerations.map((generation) => (
                  <div
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-300/40"
                    key={generation.id}
                  >
                    <p className="font-medium">{generation.prompt}</p>
                    <p className="mt-1 text-sm capitalize text-slate-300">
                      {generation.status} ·{" "}
                      {new Date(generation.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p className="font-semibold text-white">
                    No generated images available.
                  </p>
                  <p className="mt-2 text-sm">
                    Generate a visual in Studio to start your image library.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="glass-card p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-black">Recent marketing</h2>
              <Link
                className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                href="/marketing"
              >
                Generate content
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {marketingGenerations.length ? (
                marketingGenerations.map((generation) => (
                  <div
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-cyan-300/40"
                    key={generation.id}
                  >
                    <p className="font-medium">{generation.prompt}</p>
                    <p className="mt-1 text-sm capitalize text-slate-300">
                      {generation.status} ·{" "}
                      {new Date(generation.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <p className="font-semibold text-white">
                    No generated campaigns available.
                  </p>
                  <p className="mt-2 text-sm">
                    Add a brief to generate social, email, and SEO outputs.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
