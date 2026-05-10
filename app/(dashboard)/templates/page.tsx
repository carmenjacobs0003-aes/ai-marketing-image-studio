import { requireUser } from "@/lib/auth/session";

const templates = ["Product hero", "Paid social square", "Story frame", "Email banner"];

export default async function TemplatesPage() {
  await requireUser("/templates");

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Templates</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Reusable creative templates</h1>
        </header>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((template) => (
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6" key={template}>
              <div className="mb-5 aspect-square rounded-xl border border-cyan-300/20 bg-cyan-300/10" />
              <h2 className="font-black">{template}</h2>
              <p className="mt-2 text-sm text-slate-300">Protected template available after login.</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
