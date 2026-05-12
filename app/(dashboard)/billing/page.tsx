import Link from "next/link";
import { CancelSubscriptionButton } from "@/components/billing/cancel-subscription-button";
import { PricingCards } from "@/components/billing/pricing-cards";
import { getBillingPlan, getPlanByPayPalPlanId } from "@/lib/billing/plans";
import { getProfile, updateProfileSubscription } from "@/lib/db/queries";
import { getPayPalSubscription } from "@/lib/paypal/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/session";
import { getUsageSummary } from "@/lib/usage/limits";

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not scheduled";
}

function toProfileStatus(status?: string) {
  if (status === "ACTIVE") return "active";
  if (status === "SUSPENDED") return "suspended";
  if (status === "CANCELLED") return "cancelled";
  if (status === "EXPIRED") return "expired";
  return "approval_pending";
}

export default async function BillingPage({
  searchParams
}: {
  searchParams?: { paypal?: string };
}) {
  const user = await requireUser("/billing");
  const supabase = createSupabaseAdminClient();
  let profile = await getProfile(supabase, user.id);

  if (profile?.paypal_subscription_id && searchParams?.paypal === "approved") {
    try {
      const subscription = await getPayPalSubscription(
        profile.paypal_subscription_id
      );
      const matchedPlan = getPlanByPayPalPlanId(subscription.plan_id);
      const subscriptionStatus = toProfileStatus(subscription.status);
      profile = await updateProfileSubscription(supabase, user.id, {
        plan:
          subscriptionStatus === "active" && matchedPlan
            ? matchedPlan.id
            : "free",
        subscription_status: subscriptionStatus,
        paypal_plan_id: subscription.plan_id ?? profile.paypal_plan_id,
        paypal_customer_id:
          subscription.subscriber?.payer_id ?? profile.paypal_customer_id,
        subscription_current_period_end:
          subscription.billing_info?.next_billing_time ??
          profile.subscription_current_period_end
      });
    } catch {
      // PayPal webhooks remain the source of truth if an immediate return sync fails.
    }
  }

  const currentPlan = getBillingPlan(profile?.plan ?? "free");
  const usage = await getUsageSummary(user.id);

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-hero md:p-8">
          <p className="eyebrow">Billing</p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Billing
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Manage your generation limits and subscription plan.
              </p>
            </div>
            <Link className="neon-button" href="/pricing">
              View plans
            </Link>
          </div>
        </header>

        {searchParams?.paypal === "approved" ? (
          <p className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-sm text-cyan-100">
            PayPal approval received. Your plan updates when the subscription
            becomes active.
          </p>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <article className="metric-card">
            <p className="text-sm text-slate-400">Current Plan</p>
            <p className="mt-2 text-3xl font-black text-cyan-300">
              {currentPlan.name}
            </p>
          </article>
          <article className="metric-card">
            <p className="text-sm text-slate-400">Monthly allocation</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-white">
              Includes {currentPlan.monthlyImageGenerations} image and{" "}
              {currentPlan.monthlyMarketingGenerations} marketing generations.
              Use them in any combination up to{" "}
              {currentPlan.monthlyPooledGenerations} total monthly generations.
            </p>
          </article>
          <article className="metric-card">
            <p className="text-sm text-slate-400">Monthly usage</p>
            <p className="mt-2 text-2xl font-black text-white">
              {usage.totalGenerations}/{usage.monthlyGenerationLimit}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {usage.remainingGenerations} remaining this month
            </p>
          </article>
          <article className="metric-card">
            <p className="text-sm text-slate-400">Next billing date</p>
            <p className="mt-2 text-2xl font-black text-white">
              {formatDate(profile?.subscription_current_period_end)}
            </p>
          </article>
        </section>

        <section className="rounded-3xl border border-cyan-300/20 bg-black/80 p-6 ring-1 ring-white/10 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black">Subscription</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Plan changes are handled through PayPal. Cancellations return
                the account to Free after confirmation.
              </p>
            </div>
            {profile?.paypal_subscription_id &&
            profile.subscription_status === "active" ? (
              <CancelSubscriptionButton />
            ) : (
              <Link className="ghost-button" href="/pricing">
                View plans
              </Link>
            )}
          </div>
        </section>

        <PricingCards currentPlan={profile?.plan} />
      </div>
    </main>
  );
}
