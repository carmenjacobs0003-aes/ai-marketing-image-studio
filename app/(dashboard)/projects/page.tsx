import { requireUser } from "@/lib/auth/session";
import { listProjects } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const user = await requireUser("/projects");
  const supabase = createSupabaseServerClient();
  const projects = await listProjects(supabase, user.id);

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Projects
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Your campaign workspaces
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Projects can connect brand kits, marketing copy, and generated
            images under one campaign.
          </p>
        </header>
        <section className="grid gap-4 md:grid-cols-2">
          {projects.length ? (
            projects.map((project) => (
              <article
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
                key={project.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <h2 className="text-xl font-black">{project.name}</h2>
                  <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs font-semibold capitalize text-cyan-100">
                    {project.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {project.description ?? "No description yet."}
                </p>
                <p className="mt-4 text-xs text-slate-400">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-slate-300 md:col-span-2">
              No projects yet. Generate images or marketing copy to start
              building your workspace.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
