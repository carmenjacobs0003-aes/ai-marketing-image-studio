import Link from "next/link";

export function MarketingHero() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
      <p className="mb-4 rounded-full border border-white/10 px-4 py-2 text-sm text-brand-100">
        AI Marketing & Image Content Studio SaaS
      </p>
      <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
        Generate campaign-ready visuals in minutes.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-slate-300">
        A Next.js 14 App Router foundation prepared for Supabase, OpenAI, PayPal, Upstash Redis, and Sentry.
      </p>
      <div className="mt-8 flex gap-3">
        <Link className="rounded-full bg-brand-500 px-6 py-3 font-semibold" href="/signup">
          Start creating
        </Link>
        <Link className="rounded-full border border-white/10 px-6 py-3 font-semibold" href="/pricing">
          View pricing
        </Link>
      </div>
    </main>
  );
}
