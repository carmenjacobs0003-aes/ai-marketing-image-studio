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
          <p className="eyebrow">Plans</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
            Choose the right generation limits.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Start free, then unlock advanced templates, higher daily limits,
            faster queues, and expanded usage with secure PayPal billing.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link className="neon-button" href={user ? "/billing" : "/signup"}>
              {user ? "Open billing" : "Create account"}
            </Link>
            <Link className="ghost-button" href="/login">
              Sign in
            </Link>
          </div>
        </div>
        <PricingCards currentPlan={profile?.plan} />
        <section className="glass-card p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h2 className="text-xl font-black text-cyan-300">Billing sync</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                PayPal subscription status stays aligned with your account
                profile.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-black text-cyan-300">Plan access</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Generation limits and advanced templates are checked before
                requests run.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-black text-cyan-300">
                Responsive by default
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Pricing stays clear across desktop and mobile.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
