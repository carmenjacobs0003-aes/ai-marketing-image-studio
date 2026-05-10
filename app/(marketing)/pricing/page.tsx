import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8 text-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Pricing</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Start free. Scale when campaigns grow.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">Choose a plan after creating your protected studio account.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {["Free", "Pro", "Team"].map((plan) => (
            <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-6" key={plan}>
              <h2 className="text-2xl font-black text-cyan-300">{plan}</h2>
              <p className="mt-3 text-sm text-slate-300">Protected workspace, private generated images, and Supabase-backed usage tracking.</p>
            </article>
          ))}
        </div>
        <Link className="inline-flex rounded-full bg-cyan-300 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200" href="/signup">Create account</Link>
      </div>
    </main>
  );
}
