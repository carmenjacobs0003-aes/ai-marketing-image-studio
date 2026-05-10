import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { LogoutButton } from "@/components/auth/logout-button";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/marketing", label: "Marketing" },
  { href: "/images", label: "Images" },
  { href: "/projects", label: "Projects" },
  { href: "/brand", label: "Brand" },
  { href: "/templates", label: "Templates" },
  { href: "/billing", label: "Billing" },
  { href: "/admin", label: "Admin" }
];

export function AppShell({
  children,
  user
}: {
  children: React.ReactNode;
  user?: User;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              className="text-lg font-black tracking-tight text-white"
              href="/dashboard"
            >
              AI<span className="text-cyan-300">Studio</span>
            </Link>
            <div className="lg:hidden">
              <LogoutButton className="px-3 py-2" />
            </div>
          </div>
          <nav
            aria-label="Protected app navigation"
            className="flex gap-2 overflow-x-auto pb-1 lg:pb-0"
          >
            {navItems.map((item) => (
              <Link
                className="shrink-0 rounded-full border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/70 hover:text-cyan-300"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <p className="max-w-48 truncate text-sm text-slate-400">
              {user?.email}
            </p>
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
