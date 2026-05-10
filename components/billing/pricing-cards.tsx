import Link from "next/link";
import type { AppPlan } from "@/lib/db/types";
import { billingPlans, formatPlanLimit } from "@/lib/billing/plans";
import { UpgradeButton } from "@/components/billing/upgrade-button";

export function PricingCards({ currentPlan }: { currentPlan?: AppPlan }) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {billingPlans.map((plan) => {
        const isCurrent = currentPlan === plan.id;
        const cardClass = plan.highlighted
          ? "border-cyan-300/70 bg-cyan-300/[0.08] shadow-[0_0_60px_rgba(34,211,238,0.28)]"
          : "border-cyan-300/20 bg-white/[0.035] shadow-[0_0_40px_rgba(34,211,238,0.12)]";

        return (
          <article
            className={`relative overflow-hidden rounded-3xl border p-6 text-left ring-1 ring-white/10 ${cardClass}`}
            key={plan.id}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
            <div className="absolute -right-20 -top-24 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
            {plan.highlighted ? (
              <span className="rounded-full border border-cyan-300/50 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
                Best value
              </span>
            ) : null}
            <h2 className="mt-5 text-3xl font-black text-white">{plan.name}</h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-300">
              {plan.tagline}
            </p>
            <div className="mt-6 flex items-end gap-2">
              <p className="text-5xl font-black tracking-tight text-cyan-300">
                {plan.price}
              </p>
              <p className="pb-2 text-sm text-slate-400">{plan.cadence}</p>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-black/50 p-3">
                <dt className="text-slate-400">Marketing</dt>
                <dd className="mt-1 font-black text-white">
                  {formatPlanLimit(plan.dailyMarketingGenerations)}
                </dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/50 p-3">
                <dt className="text-slate-400">Images</dt>
                <dd className="mt-1 font-black text-white">
                  {formatPlanLimit(plan.dailyImageGenerations)}
                </dd>
              </div>
            </dl>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {plan.features.map((feature) => (
                <li className="flex gap-3" key={feature}>
                  <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              {plan.id === "free" ? (
                <Link
                  className="inline-flex w-full justify-center rounded-xl border border-cyan-300/30 px-4 py-3 font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
                  href="/signup"
                >
                  Start free
                </Link>
              ) : isCurrent ? (
                <Link
                  className="inline-flex w-full justify-center rounded-xl border border-cyan-300/50 bg-cyan-300/10 px-4 py-3 font-semibold text-cyan-100"
                  href="/billing"
                >
                  Current plan
                </Link>
              ) : (
                <UpgradeButton
                  className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  plan={plan.id}
                >
                  Upgrade with PayPal
                </UpgradeButton>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
