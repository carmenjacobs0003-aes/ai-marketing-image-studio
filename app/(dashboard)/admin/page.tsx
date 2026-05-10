import { requireUser } from "@/lib/auth/session";

export default async function AdminPage() {
  const user = await requireUser("/admin");

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="glass-card p-6 sm:p-8">
          <p className="eyebrow">Admin</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Workspace administration</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Protected admin surface for {user.email}. Add role checks here before exposing privileged operations.</p>
        </header>
        <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-6 text-cyan-50">
          Supabase middleware and server helpers are enforcing authentication before this route renders.
        </section>
      </div>
    </main>
  );
}
