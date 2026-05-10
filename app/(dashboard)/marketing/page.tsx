import { requireUser } from "@/lib/auth/session";

const campaigns = ["Launch ads", "Seasonal promos", "Social stories", "Email headers"];

export default async function MarketingPage() {
  await requireUser("/marketing");

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Marketing</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Protected campaign command center</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Plan campaign image sets behind authenticated routing before generating final assets.</p>
        </header>
        <section className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6" key={campaign}>
              <h2 className="text-xl font-black">{campaign}</h2>
              <p className="mt-2 text-sm text-slate-300">Build briefs, collect prompt ideas, and keep campaign creative private to your workspace.</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
