import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const user = await requireUser("/projects");
  const supabase = createSupabaseServerClient();
  const { data: projects, error } = await supabase.from("projects").select("id,name,description,created_at").eq("user_id", user.id).order("created_at", { ascending: false });

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Projects</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Your campaign workspaces</h1>
        </header>
        {error ? <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">Unable to load projects: {error.message}</p> : null}
        <section className="grid gap-4 md:grid-cols-2">
          {projects?.length ? (
            projects.map((project) => (
              <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-6" key={project.id}>
                <h2 className="text-xl font-black">{project.name}</h2>
                <p className="mt-2 text-sm text-slate-300">{project.description ?? "No description yet."}</p>
                <p className="mt-4 text-xs text-slate-400">Created {new Date(project.created_at).toLocaleDateString()}</p>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-slate-300 md:col-span-2">No projects yet. Generate images in the studio to start building your workspace.</p>
          )}
        </section>
      </div>
    </main>
  );
}
