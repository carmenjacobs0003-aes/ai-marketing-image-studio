import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  BarChart3,
  Brush,
  CreditCard,
  FolderKanban,
  ImageIcon,
  LayoutTemplate,
  Megaphone,
  Shield,
  Sparkles
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/images", label: "Images", icon: ImageIcon },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/brand", label: "Brand", icon: Brush },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/admin", label: "Admin", icon: Shield }
];

export function AppShell({
  children,
  user
}: {
  children: React.ReactNode;
  user?: User;
}) {
  return (
    <div className="aurora-shell">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/10 bg-black/70 p-4 backdrop-blur-2xl lg:block">
        <div className="flex h-full flex-col">
          <Link
            className="group flex items-center gap-3 rounded-3xl border border-cyan-300/20 bg-white/[0.04] p-4 shadow-glow transition hover:border-cyan-300/60"
            href="/dashboard"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.55)]">
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

          <nav aria-label="Protected app navigation" className="mt-6 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  className="group flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-white hover:shadow-[0_0_26px_rgba(34,211,238,0.14)]"
                  href={item.href}
                  key={item.href}
                >
                  <Icon className="h-4 w-4 text-cyan-300 transition group-hover:scale-110" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4 shadow-glow">
            <p className="eyebrow">Premium ready</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Upgrade for higher limits, premium templates, and cinematic brand
              systems.
            </p>
            <Link className="ghost-button mt-4 w-full py-2" href="/billing">
              Manage plan
            </Link>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/70 backdrop-blur-2xl lg:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <Link className="text-lg font-black tracking-tight text-white" href="/dashboard">
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
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/70 hover:text-cyan-300"
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
  );
}
