"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Crown,
  Mail,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  Zap
} from "lucide-react";
import {
  defaultNotificationPreferences,
  type NotificationPreferences
} from "@/lib/notifications/types";
import { useNotifications } from "@/components/notifications/notification-center";

const STORAGE_KEY = "syntrix-ai.notification-preferences.v1";

type UserPreferencesPanelProps = {
  email?: string | null;
  fullName?: string | null;
  plan: string;
};

const badgePlaceholders = [
  { title: "First Project", body: "Create a project workspace.", ready: false },
  { title: "Signal Saver", body: "Save your first generation.", ready: false },
  {
    title: "Gallery Pulse",
    body: "Receive a like, copy, or remix.",
    ready: false
  },
  {
    title: "Brand Architect",
    body: "Complete a reusable brand kit.",
    ready: false
  },
  {
    title: "Weekly Streak",
    body: "Generate assets two weeks in a row.",
    ready: false
  }
];

function loadPreferences(): NotificationPreferences {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaultNotificationPreferences;

  try {
    return {
      ...defaultNotificationPreferences,
      ...(JSON.parse(stored) as Partial<NotificationPreferences>)
    };
  } catch {
    return defaultNotificationPreferences;
  }
}

export function UserPreferencesPanel({
  email,
  fullName,
  plan
}: UserPreferencesPanelProps) {
  const { notify, toast } = useNotifications();
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    defaultNotificationPreferences
  );
  const [displayName, setDisplayName] = useState(fullName ?? "");
  const profileCompletion = useMemo(() => {
    const checks = [
      Boolean(displayName.trim()),
      preferences.inApp,
      preferences.weeklyDigest,
      preferences.creatorActivity,
      preferences.galleryInteractions
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [displayName, preferences]);

  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);

  function updatePreference(key: keyof NotificationPreferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    toast({
      tone: "success",
      title: "Preference saved",
      body: "Notification routing was updated on this device."
    });
  }

  function saveProfile() {
    window.localStorage.setItem(
      "syntrix-ai.profile-display-name.v1",
      displayName
    );
    notify({
      kind: "profile_completion",
      tone: "success",
      title: "Profile preferences saved",
      body: "Your profile completion prompt has been refreshed.",
      href: "/settings"
    });
  }

  return (
    <div className="space-y-8">
      <section className="page-hero">
        <div className="neon-orb -right-16 top-6 h-56 w-56" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
          <div>
            <p className="eyebrow">User settings</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">
              Preference controls for retention, digest, and creator
              notifications.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              Manage in-app alerts, email notification readiness, weekly digest
              framework, gallery interactions, creator activity, profile
              prompts, and placeholder achievement badges.
            </p>
          </div>
          <div className="holo-panel">
            <p className="eyebrow">Profile signal</p>
            <p className="mt-3 text-5xl font-black text-cyan-300">
              {profileCompletion}%
            </p>
            <p className="mt-3 text-sm text-slate-300">
              Complete your profile to reduce setup friction and improve guided
              recommendations.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="glass-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow">Profile completion</p>
              <h2 className="mt-1 text-2xl font-black">Creator identity</h2>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block space-y-2 text-sm font-medium">
              <span>Email</span>
              <input className="field-control" disabled value={email ?? ""} />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>Display name</span>
              <input
                className="field-control"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your creator name"
                value={displayName}
              />
            </label>
            <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.75)]"
                  style={{ width: `${profileCompletion}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Plan:{" "}
                <span className="font-black capitalize text-cyan-200">
                  {plan}
                </span>
                . Upgrade prompts appear when limits, templates, or
                collaboration features become relevant.
              </p>
            </div>
            <button
              className="neon-button w-full"
              onClick={saveProfile}
              type="button"
            >
              Save profile preferences
            </button>
          </div>
        </article>

        <article className="glass-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              <Bell className="h-5 w-5" />
            </span>
            <div>
              <p className="eyebrow">Notification routing</p>
              <h2 className="mt-1 text-2xl font-black">
                In-app + email support
              </h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(preferences).map(([key, enabled]) => (
              <button
                className={`rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 ${enabled ? "border-cyan-300/45 bg-cyan-300/10" : "border-white/10 bg-white/[0.03]"}`}
                key={key}
                onClick={() =>
                  updatePreference(key as keyof NotificationPreferences)
                }
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black capitalize text-white">
                    {key.replace(/([A-Z])/g, " $1")}
                  </p>
                  <span
                    className={`h-5 w-10 rounded-full border p-0.5 ${enabled ? "border-cyan-300 bg-cyan-300/20" : "border-white/15 bg-white/5"}`}
                  >
                    <span
                      className={`block h-3.5 w-3.5 rounded-full bg-cyan-300 transition ${enabled ? "translate-x-5" : "translate-x-0 bg-slate-500"}`}
                    />
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-300">
                  {enabled ? "Enabled" : "Paused"} for retention workflows.
                </p>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="glass-card p-5">
          <Mail className="h-8 w-8 text-cyan-300" />
          <h2 className="mt-4 text-xl font-black">Weekly digest framework</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Digest jobs can summarize generation counts, saved assets, gallery
            likes, new badges, and creator activity highlights.
          </p>
        </article>
        <article className="glass-card p-5">
          <Zap className="h-8 w-8 text-cyan-300" />
          <h2 className="mt-4 text-xl font-black">Usage warnings</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Realtime alerts appear near 80% of daily limits and convert into
            upgrade prompts when free capacity is exhausted.
          </p>
        </article>
        <article className="glass-card p-5">
          <Crown className="h-8 w-8 text-cyan-300" />
          <h2 className="mt-4 text-xl font-black">Upgrade prompts</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Plan-aware prompts keep monetization visible without blocking the
            creative flow.
          </p>
        </article>
      </section>

      <section className="glass-card p-6" id="achievements">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Achievements</p>
            <h2 className="mt-2 text-2xl font-black">Badge placeholders</h2>
          </div>
          <span className="premium-badge">Framework ready</span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {badgePlaceholders.map((badge) => (
            <article
              className="rounded-3xl border border-white/10 bg-white/[0.035] p-4"
              key={badge.title}
            >
              <Trophy className="h-8 w-8 text-cyan-300" />
              <h3 className="mt-3 font-black">{badge.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{badge.body}</p>
              <p className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                <ShieldCheck className="h-4 w-4" /> Placeholder
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="empty-state flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-white">Test a realtime notification</p>
          <p className="mt-1 text-sm">
            Trigger a sample creator activity notification without changing
            account data.
          </p>
        </div>
        <button
          className="ghost-button"
          onClick={() =>
            notify({
              kind: "creator_activity",
              tone: "info",
              title: "Creator activity preview",
              body: "Someone remixed a gallery prompt. This is how creator retention nudges will appear.",
              href: "/gallery"
            })
          }
          type="button"
        >
          <Sparkles className="mr-2 h-4 w-4" /> Preview notification
        </button>
      </section>
    </div>
  );
}
