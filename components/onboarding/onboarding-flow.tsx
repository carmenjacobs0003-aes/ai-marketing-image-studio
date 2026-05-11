"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Play,
  Rocket,
  Sparkles,
  Wand2,
  X
} from "lucide-react";
import {
  getOnboardingProgress,
  onboardingSteps,
  type OnboardingStepId
} from "@/lib/onboarding/progress";
import { useNotifications } from "@/components/notifications/notification-center";

const STORAGE_KEY = "aistudio.onboarding.v1";

type StoredOnboarding = {
  completed: OnboardingStepId[];
  dismissedWelcome: boolean;
};

const initialStored: StoredOnboarding = {
  completed: [],
  dismissedWelcome: false
};

function readStored(): StoredOnboarding {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return initialStored;

  try {
    return {
      ...initialStored,
      ...(JSON.parse(stored) as Partial<StoredOnboarding>)
    };
  } catch {
    return initialStored;
  }
}

function writeStored(value: StoredOnboarding) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function OnboardingFlow({
  hasProjects,
  hasBrandKits,
  hasGenerations,
  profileComplete
}: {
  hasProjects: boolean;
  hasBrandKits: boolean;
  hasGenerations: boolean;
  profileComplete: boolean;
}) {
  const { notify } = useNotifications();
  const [stored, setStored] = useState<StoredOnboarding>(initialStored);
  const [open, setOpen] = useState(false);
  const completed = useMemo(() => {
    const next = new Set<OnboardingStepId>(stored.completed);
    next.add("welcome");
    if (profileComplete) next.add("profile");
    if (hasBrandKits) next.add("brand");
    if (hasProjects) next.add("project");
    if (hasGenerations) next.add("generate");
    return Array.from(next);
  }, [
    hasBrandKits,
    hasGenerations,
    hasProjects,
    profileComplete,
    stored.completed
  ]);
  const progress = getOnboardingProgress(completed);
  const nextStep =
    onboardingSteps.find((step) => !completed.includes(step.id)) ??
    onboardingSteps[onboardingSteps.length - 1];

  useEffect(() => {
    const next = readStored();
    setStored(next);
    const params = new URLSearchParams(window.location.search);
    const shouldOpen =
      params.get("onboarding") === "1" ||
      (!next.dismissedWelcome && progress.percent < 100);
    setOpen(shouldOpen);
  }, [progress.percent]);

  useEffect(() => {
    writeStored({ ...stored, completed });
  }, [completed, stored]);

  function markComplete(id: OnboardingStepId) {
    const nextCompleted = Array.from(new Set([...completed, id]));
    const nextStored = { ...stored, completed: nextCompleted };
    setStored(nextStored);
    writeStored(nextStored);
    notify({
      kind: "achievement",
      tone: "success",
      title: "Onboarding step complete",
      body: `${onboardingSteps.find((step) => step.id === id)?.title ?? "Step"} is now tracked in your launch progress.`,
      href: "/dashboard"
    });
  }

  function dismiss() {
    const nextStored = { ...stored, dismissedWelcome: true };
    setStored(nextStored);
    writeStored(nextStored);
    setOpen(false);
  }

  return (
    <>
      <section className="glass-card overflow-hidden p-5">
        <div className="absolute inset-0 opacity-70">
          <div className="onboarding-grid" />
          <div className="neon-orb left-10 top-6 h-28 w-28" />
        </div>
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <span className="onboarding-core">
              <Sparkles className="h-6 w-6" />
            </span>
            <div>
              <p className="eyebrow">Onboarding signal</p>
              <h2 className="mt-2 text-2xl font-black">
                {progress.percent}% launch ready
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Follow the guided setup to complete your profile, create a brand
                kit, launch a first project, and generate your first campaign
                asset.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              className="ghost-button"
              onClick={() => setOpen(true)}
              type="button"
            >
              <Play className="mr-2 h-4 w-4" /> Tutorial
            </button>
            <Link className="neon-button" href={nextStep.href}>
              Next: {nextStep.title} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="relative z-10 mt-5 h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.8)]"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl">
          <section className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-black shadow-[0_0_90px_rgba(34,211,238,0.22)]">
            <div className="scanline" />
            <div className="onboarding-grid absolute inset-0 opacity-70" />
            <div className="neon-orb -right-16 top-0 h-56 w-56" />
            <div className="relative z-10 grid max-h-[92vh] overflow-y-auto lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r lg:p-8">
                <button
                  className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 hover:border-cyan-300/70 hover:text-white"
                  onClick={dismiss}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="eyebrow">Welcome tutorial</p>
                <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                  Build your first neon campaign in minutes.
                </h1>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  AIStudio now tracks onboarding progress, nudges your first
                  project setup, and sends realtime notifications when saves,
                  gallery interactions, usage warnings, upgrades, and badges
                  need attention.
                </p>
                <div className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5">
                  <div className="flex items-center gap-3">
                    <Rocket className="h-8 w-8 text-cyan-300" />
                    <div>
                      <p className="font-black">First-project guided setup</p>
                      <p className="text-sm text-slate-300">
                        Next recommended action: {nextStep.title}
                      </p>
                    </div>
                  </div>
                  <Link
                    className="neon-button mt-5 w-full"
                    href={nextStep.href}
                    onClick={dismiss}
                  >
                    Start next step <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="space-y-3 p-6 lg:p-8">
                {onboardingSteps.map((step, index) => {
                  const done = completed.includes(step.id);
                  return (
                    <article
                      className={`rounded-3xl border p-4 ${done ? "border-cyan-300/35 bg-cyan-300/10" : "border-white/10 bg-white/[0.035]"}`}
                      key={step.id}
                    >
                      <div className="flex gap-4">
                        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-black/55 text-cyan-200">
                          {done ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                            Step {index + 1}
                          </p>
                          <h3 className="mt-1 text-lg font-black">
                            {step.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-slate-300">
                            {step.body}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Link
                              className="ghost-button px-3 py-2 text-sm"
                              href={step.href}
                              onClick={dismiss}
                            >
                              <Wand2 className="mr-2 h-4 w-4" /> Open
                            </Link>
                            <button
                              className="ghost-button px-3 py-2 text-sm"
                              onClick={() => markComplete(step.id)}
                              type="button"
                            >
                              Mark done
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
