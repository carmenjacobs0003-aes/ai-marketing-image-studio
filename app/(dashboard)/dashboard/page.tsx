import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getUsageSummary } from "@/lib/usage/limits";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = createSupabaseServerClient();
  const usage = await getUsageSummary(user.id);
  const { count: projectCount } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  const { data: generations } = await supabase
    .from("image_generations")
    .select("id,prompt,status,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Dashboard</p>
            <h1 className="mt-2 text-4xl font-bold">Welcome, {user.email}</h1>
          </div>
          <div className="flex gap-3">
            <Link className="rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950" href="/studio">Open studio</Link>
            <Link className="rounded-xl border border-white/10 px-4 py-3 font-semibold" href="/logout">Log out</Link>
          </div>
        </header>
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">Plan</p>
            <p className="mt-2 text-3xl font-bold capitalize">{usage.plan}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">Monthly generations</p>
            <p className="mt-2 text-3xl font-bold">{usage.imageGenerations}/{usage.imageGenerationLimit}</p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">Projects</p>
            <p className="mt-2 text-3xl font-bold">{projectCount ?? 0}</p>
          </article>
        </section>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recent generations</h2>
            <Link className="text-sm font-semibold text-cyan-300" href="/projects">View projects</Link>
          </div>
          <div className="mt-4 space-y-3">
            {generations?.length ? (
              generations.map((generation) => (
                <div className="rounded-xl border border-white/10 p-4" key={generation.id}>
                  <p className="font-medium">{generation.prompt}</p>
                  <p className="mt-1 text-sm capitalize text-slate-300">{generation.status} · {new Date(generation.created_at).toLocaleString()}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-300">No images generated yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
