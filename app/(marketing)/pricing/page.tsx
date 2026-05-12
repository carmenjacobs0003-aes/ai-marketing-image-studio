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
            Simple plans for AI campaign generation.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Choose monthly image and marketing generation limits with secure
            PayPal billing.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link className="neon-button" href={user ? "/billing" : "/signup"}>
              {user ? "Open billing" : "Start free"}
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
              <h2 className="text-xl font-black text-cyan-300">Secure billing</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                PayPal keeps subscription status aligned with your account.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-black text-cyan-300">Clear limits</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Image and marketing generations are shown plainly for each plan.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-black text-cyan-300">
                Commercial plans
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Creator and Studio support consistent production workflows.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
