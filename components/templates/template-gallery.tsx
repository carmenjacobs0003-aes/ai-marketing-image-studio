"use client";

import {
  marketingTemplates,
  type TemplateCategory
} from "@/lib/templates/catalog";

const labels: Record<TemplateCategory, string> = {
  social: "Social templates",
  email: "Email templates",
  seo: "SEO templates",
  industry: "Industry presets"
};

export function TemplateGallery() {
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
              .map((template) => (
                <article
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/60 hover:shadow-[0_0_30px_rgba(34,211,238,0.16)]"
                  key={template.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-lg font-black text-white">
                        {template.name}
                      </h2>
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
                </article>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
