"use client";

import Link from "next/link";
import type { AppPlan } from "@/lib/db/types";
import {
  marketingTemplates,
  type TemplateCategory
} from "@/lib/templates/catalog";
import { isPaidPlan } from "@/lib/billing/plans";

const labels: Record<TemplateCategory, string> = {
  social: "Social templates",
  email: "Email templates",
  seo: "SEO templates",
  industry: "Industry presets"
};

export function TemplateGallery({ plan = "free" }: { plan?: AppPlan }) {
  const canUsePremiumTemplates = isPaidPlan(plan);

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      {(Object.keys(labels) as TemplateCategory[]).map((category) => (
        <div
          className="rounded-3xl border border-cyan-300/20 bg-black/80 p-5 shadow-2xl shadow-cyan-500/10 ring-1 ring-white/10"
          key={category}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
            {labels[category]}
          </p>
          <div className="mt-4 grid gap-3">
            {marketingTemplates
              .filter((template) => template.category === category)
              .map((template) => {
                const locked = Boolean(
                  template.premium && !canUsePremiumTemplates
                );

                return (
                  <article
                    className={`rounded-2xl border bg-white/[0.04] p-4 transition ${
                      locked
                        ? "border-cyan-300/20 opacity-80"
                        : "border-white/10 hover:border-cyan-300/60 hover:shadow-[0_0_30px_rgba(34,211,238,0.16)]"
                    }`}
                    key={template.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-black text-white">
                            {template.name}
                          </h2>
                          {template.premium ? (
                            <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">
                              Pro
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {template.description}
                        </p>
                      </div>
                      <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs font-semibold text-cyan-100">
                        {template.contentType.replaceAll("_", " ")}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {template.channels.map((channel) => (
                        <span
                          className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100"
                          key={channel}
                        >
                          {channel}
                        </span>
                      ))}
                    </div>
                    {locked ? (
                      <Link
                        className="mt-4 inline-flex rounded-full border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
                        href="/pricing"
                      >
                        Upgrade to unlock premium template
                      </Link>
                    ) : null}
                  </article>
                );
              })}
          </div>
        </div>
      ))}
    </section>
  );
}
