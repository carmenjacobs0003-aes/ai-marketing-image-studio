import Link from "next/link";

export function MarketingHero() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center bg-black px-6 py-16 text-center text-white">
      <p className="mb-4 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100">
        AI Marketing & Image Content Studio SaaS
      </p>
      <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
        Generate campaign-ready visuals in <span className="text-cyan-300">minutes</span>.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
        A production-ready Next.js 14 foundation with Supabase SSR authentication, protected app routes, OpenAI images, PayPal, Upstash Redis, and Sentry.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link className="rounded-full bg-cyan-300 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200" href="/signup">
          Start creating
        </Link>
        <Link className="rounded-full border border-white/10 px-6 py-3 font-semibold transition hover:border-cyan-300/70 hover:text-cyan-300" href="/pricing">
          View pricing
        </Link>
      </div>
    </main>
  );
}
