import { TemplateGallery } from "@/components/templates/template-gallery";
import { requireUser } from "@/lib/auth/session";

export default async function TemplatesPage() {
  await requireUser("/templates");

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-cyan-300/20 bg-black/80 p-6 shadow-2xl shadow-cyan-500/10 ring-1 ring-white/10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Templates
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Reusable template system
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Choose production-ready social, email, SEO, and industry presets in
            the Marketing generator to shape outputs without rebuilding prompts
            from scratch.
          </p>
        </header>
        <TemplateGallery />
      </div>
    </main>
  );
}
