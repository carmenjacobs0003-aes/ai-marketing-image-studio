"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  Bell,
  Check,
  Crown,
  ImagePlus,
  Megaphone,
  Settings,
  Sparkles,
  Trophy,
  UserRound,
  X,
  Zap
} from "lucide-react";
import type {
  AppNotification,
  NotificationKind,
  NotificationTone
} from "@/lib/notifications/types";
import type { UsageSummary } from "@/lib/usage/limits";

type Toast = {
  id: string;
  tone: NotificationTone;
  title: string;
  body?: string;
};

type NotificationContextValue = {
  notify: (
    notification: Omit<AppNotification, "id" | "createdAt" | "read"> &
      Partial<Pick<AppNotification, "id" | "createdAt" | "read">>
  ) => void;
  toast: (toast: Omit<Toast, "id">) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(
  null
);
const STORAGE_KEY = "syntrix-ai.notifications.v1";

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function iconFor(kind: NotificationKind) {
  switch (kind) {
    case "upgrade":
      return Crown;
    case "usage_warning":
      return Zap;
    case "saved_generation":
      return ImagePlus;
    case "creator_activity":
      return Megaphone;
    case "gallery_interaction":
      return Sparkles;
    case "profile_completion":
      return UserRound;
    case "achievement":
      return Trophy;
    default:
      return Bell;
  }
}

function toneClasses(tone: NotificationTone) {
  if (tone === "success")
    return "border-emerald-300/40 bg-emerald-400/10 text-emerald-100";
  if (tone === "warning")
    return "border-amber-300/40 bg-amber-400/10 text-amber-100";
  if (tone === "error") return "border-red-300/40 bg-red-500/10 text-red-100";
  return "border-cyan-300/35 bg-cyan-300/10 text-cyan-100";
}

function defaultNotifications(email?: string | null): AppNotification[] {
  const now = new Date().toISOString();

  return [
    {
      id: "welcome-command-deck",
      kind: "welcome",
      tone: "success",
      title: "Welcome to SYNTRIX AI",
      body: `Your generation workspace is online${email ? ` for ${email}` : ""}. Start setup to prepare your first generation.`,
      href: "/dashboard?onboarding=1",
      createdAt: now,
      read: false
    },
    {
      id: "profile-completion",
      kind: "profile_completion",
      tone: "info",
      title: "Complete your profile",
      body: "Set notifications, email digests, and creator preferences.",
      href: "/settings",
      createdAt: now,
      read: false
    },
    {
      id: "achievement-placeholders",
      kind: "achievement",
      tone: "info",
      title: "Achievements are being prepared",
      body: "First project, first save, and gallery activity achievements will appear here.",
      href: "/settings#achievements",
      createdAt: now,
      read: true
    }
  ];
}

function buildUsageNotifications(usage?: UsageSummary): AppNotification[] {
  if (!usage) return [];
  const notifications: AppNotification[] = [];
  const now = new Date().toISOString();
  const imageLimit = usage.imageGenerationLimit;
  const marketingLimit = usage.marketingGenerationLimit;

  if (
    imageLimit !== null &&
    imageLimit > 0 &&
    usage.imageGenerations / imageLimit >= 0.8
  ) {
    notifications.push({
      id: `usage-images-${usage.usageDate}`,
      kind: "usage_warning",
      tone: usage.imageGenerations >= imageLimit ? "error" : "warning",
      title: "AI generation usage is near limit",
      body: `${usage.imageGenerations}/${imageLimit} AI generations used today. Your allowance is shared across images and marketing.`,
      href: "/billing",
      createdAt: now,
      read: false
    });
  }

  if (
    marketingLimit !== null &&
    marketingLimit > 0 &&
    usage.marketingGenerations / marketingLimit >= 0.8
  ) {
    notifications.push({
      id: `usage-marketing-${usage.usageDate}`,
      kind: "usage_warning",
      tone: usage.marketingGenerations >= marketingLimit ? "error" : "warning",
      title: "AI generation usage is near limit",
      body: `${usage.marketingGenerations}/${marketingLimit} AI generations used today. Your allowance is shared across images and marketing.`,
      href: "/billing",
      createdAt: now,
      read: false
    });
  }

  if (usage.plan === "free") {
    notifications.push({
      id: `upgrade-free-${usage.usageDate}`,
      kind: "upgrade",
      tone: "info",
      title: "Unlock higher generation limits",
      body: "Higher limits and advanced templates are available on Pro.",
      href: "/billing",
      createdAt: now,
      read: true
    });
  }

  return notifications;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context)
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  return context;
}

export function NotificationProvider({
  children,
  email,
  usage
}: {
  children: ReactNode;
  email?: string | null;
  usage?: UsageSummary;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [open, setOpen] = useState(false);

  const toast = useCallback((toastInput: Omit<Toast, "id">) => {
    const id = makeId("toast");
    setToasts((current) => {
      const withoutDuplicate = current.filter(
        (item) =>
          item.tone !== toastInput.tone ||
          item.title !== toastInput.title ||
          item.body !== toastInput.body
      );

      return [{ id, ...toastInput }, ...withoutDuplicate].slice(0, 2);
    });
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5200);
  }, []);

  const notify = useCallback<NotificationContextValue["notify"]>(
    (notification) => {
      const next: AppNotification = {
        id: notification.id ?? makeId("notification"),
        createdAt: notification.createdAt ?? new Date().toISOString(),
        read: notification.read ?? false,
        realtime: true,
        ...notification
      };
      setNotifications((current) =>
        [next, ...current.filter((item) => item.id !== next.id)].slice(0, 20)
      );
      toast({ tone: next.tone, title: next.title, body: next.body });
    },
    [toast]
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    let parsed: AppNotification[] = [];

    if (stored) {
      try {
        parsed = JSON.parse(stored) as AppNotification[];
      } catch {
        parsed = [];
      }
    }

    const merged = [
      ...buildUsageNotifications(usage),
      ...parsed,
      ...defaultNotifications(email)
    ];
    const unique = new Map<string, AppNotification>();
    merged.forEach((notification) => unique.set(notification.id, notification));
    setNotifications(Array.from(unique.values()).slice(0, 20));
  }, [email, usage]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      const method = init?.method?.toUpperCase();
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();

      if (method && ["POST", "PATCH", "DELETE"].includes(method)) {
        const suppressGlobalToast = url.includes("/api/marketing/generate");

        if (suppressGlobalToast) {
          return response;
        }

        if (response.ok) {
          if (url.includes("save-to-project")) {
            notify({
              kind: "saved_generation",
              tone: "success",
              title: "Generation saved",
              body: "Your asset was saved to the selected project.",
              href: "/projects"
            });
          } else if (url.includes("/api/projects")) {
            notify({
              kind: "achievement",
              tone: "success",
              title: "Project progress updated",
              body: "Your first-project setup checklist has been refreshed.",
              href: "/projects"
            });
          } else if (url.includes("/favorite") || url.includes("/metric")) {
            notify({
              kind: "gallery_interaction",
              tone: "success",
              title: "Gallery activity recorded",
              body: "Interaction notifications keep creators informed in real time.",
              href: "/gallery"
            });
          } else {
            toast({
              tone: "success",
              title: "Saved",
              body: "Your change was completed successfully."
            });
          }
        } else {
          toast({
            tone: "error",
            title: "Action failed",
            body: "Please review the form and try again."
          });
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [notify, toast]);

  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;
  const value = useMemo(() => ({ notify, toast }), [notify, toast]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 lg:right-8 lg:top-5">
        <button
          aria-label="Open notifications"
          className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/35 bg-black/80 text-cyan-100 shadow-glow backdrop-blur-2xl hover:border-cyan-300/80 hover:bg-cyan-300/10"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <Bell className="h-5 w-5" />
          {unreadCount ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-300 px-1 text-[10px] font-black text-slate-950">
              {unreadCount}
            </span>
          ) : null}
        </button>
        {open ? (
          <section className="absolute right-0 mt-3 w-[min(92vw,420px)] overflow-hidden rounded-3xl border border-cyan-300/20 bg-black/90 shadow-[0_0_60px_rgba(34,211,238,0.22)] ring-1 ring-white/10 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div>
                <p className="eyebrow">Realtime</p>
                <h2 className="text-lg font-black">Notifications</h2>
              </div>
              <div className="flex gap-2">
                <button
                  className="ghost-button px-3 py-2 text-xs"
                  onClick={() =>
                    setNotifications((current) =>
                      current.map((item) => ({ ...item, read: true }))
                    )
                  }
                  type="button"
                >
                  <Check className="mr-1 h-3 w-3" /> Read
                </button>
                <Link
                  className="ghost-button px-3 py-2 text-xs"
                  href="/settings"
                  onClick={() => setOpen(false)}
                >
                  <Settings className="mr-1 h-3 w-3" /> Settings
                </Link>
              </div>
            </div>
            <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
              {notifications.map((notification) => {
                const Icon = iconFor(notification.kind);
                const content = (
                  <div
                    className={`rounded-2xl border p-3 ${toneClasses(notification.tone)} ${notification.read ? "opacity-70" : "shadow-[0_0_24px_rgba(34,211,238,0.10)]"}`}
                  >
                    <div className="flex gap-3">
                      <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/45">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-black text-white">
                            {notification.title}
                          </p>
                          {!notification.read ? (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm leading-5 text-slate-200">
                          {notification.body}
                        </p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                return notification.href ? (
                  <Link
                    href={notification.href}
                    key={notification.id}
                    onClick={() => setOpen(false)}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={notification.id}>{content}</div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
      <div className="pointer-events-none fixed right-4 top-20 z-50 w-[min(92vw,380px)] space-y-3 sm:right-6 lg:right-8">
        {toasts.map((item) => (
          <div
            className={`pointer-events-auto rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl ${toneClasses(item.tone)}`}
            key={item.id}
          >
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-black text-white">{item.title}</p>
                {item.body ? (
                  <p className="mt-1 text-sm text-slate-200">{item.body}</p>
                ) : null}
              </div>
              <button
                aria-label="Dismiss toast"
                onClick={() =>
                  setToasts((current) =>
                    current.filter((toastItem) => toastItem.id !== item.id)
                  )
                }
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
