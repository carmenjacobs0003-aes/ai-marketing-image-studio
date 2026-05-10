import Link from "next/link";
import { PricingCards } from "@/components/billing/pricing-cards";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function PricingPage() {
  const user = await getCurrentUser();
  const profile = user
    ? await getProfile(createSupabaseServerClient(), user.id)
    : null;

  return (
    <main className="min-h-screen bg-black px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
            PayPal subscriptions
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
            Monetize every generation with neon-fast plans.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Start free, then unlock premium templates, higher daily limits,
            faster queues, and agency-grade fair use with secure PayPal billing.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              className="rounded-full bg-cyan-300 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
              href={user ? "/billing" : "/signup"}
            >
              {user ? "Open billing dashboard" : "Create account"}
            </Link>
            <Link
              className="rounded-full border border-cyan-300/40 px-6 py-3 font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        </div>
        <PricingCards currentPlan={profile?.plan} />
        <section className="rounded-3xl border border-cyan-300/20 bg-white/[0.04] p-6 shadow-[0_0_40px_rgba(34,211,238,0.12)] md:p-8">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h2 className="text-xl font-black text-cyan-300">
                Subscription sync
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Webhooks keep PayPal subscription status aligned with Supabase
                profiles.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-black text-cyan-300">Plan checks</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Generation limits and premium templates are enforced before AI
                requests run.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-black text-cyan-300">Mobile first</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Black, white, and neon-blue pricing cards adapt cleanly across
                devices.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
