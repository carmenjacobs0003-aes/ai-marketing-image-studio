import { requireUser } from "@/lib/auth/session";

export default async function BrandPage() {
  await requireUser("/brand");

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Brand</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Brand system</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Authenticated teams can centralize colors, voice, product notes, and visual rules.</p>
        </header>
        <section className="grid gap-4 md:grid-cols-3">
          {["Voice", "Colors", "Products"].map((item) => (
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6" key={item}>
              <h2 className="text-xl font-black text-cyan-300">{item}</h2>
              <p className="mt-2 text-sm text-slate-300">Ready for workspace-specific brand data.</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
