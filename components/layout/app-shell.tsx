import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  BarChart3,
  Brush,
  CreditCard,
  FolderKanban,
  ImageIcon,
  GalleryHorizontalEnd,
  LayoutTemplate,
  Megaphone,
  Settings,
  Shield,
  Sparkles,
  Zap
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationProvider } from "@/components/notifications/notification-center";
import type { UsageSummary } from "@/lib/usage/limits";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },

  { href: "/studio", label: "Studio", icon: Sparkles },

  { href: "/marketing", label: "Marketing", icon: Megaphone },

  { href: "/projects", label: "Projects", icon: FolderKanban },

  { href: "/gallery", label: "Gallery", icon: GalleryHorizontalEnd },

  { href: "/brand", label: "Brand Kits", icon: Brush },

  { href: "/billing", label: "Billing", icon: CreditCard },

  { href: "/settings", label: "Settings", icon: Settings },

  { href: "/admin", label: "Admin", icon: Shield }
];

export function AppShell({
  children,
  user,
  usage
}: {
  children: React.ReactNode;
  user?: User;
  usage?: UsageSummary;
}) {
  return (
    <NotificationProvider email={user?.email} usage={usage}>
      <div className="aurora-shell">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-cyan-300/15 bg-black/60 p-4 shadow-[24px_0_80px_rgba(34,211,238,0.08)] backdrop-blur-2xl lg:block">
          <div className="scanline" />
          <div className="relative z-10 flex h-full flex-col">
            <Link
              className="group flex items-center gap-3 rounded-3xl border border-cyan-300/25 bg-white/[0.045] p-4 shadow-glow transition hover:-translate-y-0.5 hover:border-cyan-300/70 hover:bg-cyan-300/[0.08]"
              href="/dashboard"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950 shadow-[0_0_32px_rgba(34,211,238,0.68)] transition group-hover:rotate-6 group-hover:scale-105">
                <Sparkles className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-lg font-black tracking-tight text-white">
                  AI<span className="text-cyan-300">Studio</span>
                </span>
                <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Neural SaaS
                </span>
              </span>
            </Link>

            <div className="mt-5 rounded-3xl border border-white/10 bg-black/55 p-3 backdrop-blur-xl">
              <div className="flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
                <Zap className="h-3.5 w-3.5" />
                Command deck
              </div>
              <nav
                aria-label="Protected app navigation"
                className="mt-3 space-y-1.5"
              >
                {navItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      className="group flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-300 transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-white hover:shadow-[0_0_26px_rgba(34,211,238,0.14)]"
                      href={item.href}
                      key={item.href}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] transition group-hover:border-cyan-300/40 group-hover:bg-cyan-300/10">
                        <Icon className="h-4 w-4 text-cyan-300 transition group-hover:scale-110" />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="mt-auto rounded-3xl border border-cyan-300/25 bg-cyan-300/[0.06] p-4 shadow-glow backdrop-blur-xl">
              <div className="mb-4 h-2 rounded-full bg-white/10">
                <div className="h-2 w-2/3 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.75)]" />
              </div>
              <p className="eyebrow">Premium ready</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Unlock higher limits, premium templates, and cinematic brand
                systems.
              </p>
              <Link className="ghost-button mt-4 w-full py-2" href="/billing">
                Manage plan
              </Link>
            </div>
          </div>
        </aside>

        <header className="sticky top-0 z-30 border-b border-cyan-300/15 bg-black/70 backdrop-blur-2xl lg:hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <Link
              className="text-lg font-black tracking-tight text-white"
              href="/dashboard"
            >
              AI<span className="text-cyan-300">Studio</span>
            </Link>
            <LogoutButton className="px-3 py-2" />
          </div>
          <nav
            aria-label="Protected app navigation"
            className="flex gap-2 overflow-x-auto px-4 pb-4"
          >
            {navItems.map((item) => (
              <Link
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/70 hover:bg-cyan-300/10 hover:text-cyan-100"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="relative z-10 lg:pl-72">
          <div className="hidden items-center justify-end gap-3 px-8 py-5 lg:flex">
            <p className="max-w-64 truncate rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 backdrop-blur-xl">
              {user?.email}
            </p>
            <LogoutButton />
          </div>
          {children}
        </div>
      </div>
    </NotificationProvider>
  );
}
