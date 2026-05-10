import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import {
  countProjects,
  listImageGenerations,
  listMarketingGenerations
} from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/usage/limits";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const supabase = createSupabaseServerClient();
  const [usage, projectCount, imageGenerations, marketingGenerations] =
    await Promise.all([
      getUsageSummary(user.id),
      countProjects(supabase, user.id),
      listImageGenerations(supabase, user.id, 5),
      listMarketingGenerations(supabase, user.id, 5)
    ]);

  return (
    <main className="page-shell">
      <div className="page-container max-w-6xl">
        <header className="flex flex-col gap-4 page-hero md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <p className="eyebrow">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Welcome, {user.email}
            </h1>
          </div>
          <Link
            className="neon-button"
            href="/studio"
          >
            Open studio
          </Link>
        </header>
        <section className="grid gap-4 md:grid-cols-5">
          <article className="metric-card">
            <p className="text-sm text-slate-300">Plan</p>
            <p className="mt-2 text-3xl font-black capitalize text-cyan-300">
              {usage.plan}
            </p>
          </article>
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
          <article className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-6">
            <p className="text-sm text-cyan-100">Billing</p>
            <Link
              className="mt-3 inline-flex rounded-full border border-cyan-300/40 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
              href="/billing"
            >
              Manage plan
            </Link>
          </article>
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
                    className="rounded-xl border border-white/10 p-4"
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
                <p className="empty-state">
                  No images generated yet. Start with the Studio to populate this cinematic gallery.
                </p>
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
                Generate copy
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {marketingGenerations.length ? (
                marketingGenerations.map((generation) => (
                  <div
                    className="rounded-xl border border-white/10 p-4"
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
                <p className="empty-state">
                  No marketing copy generated yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
