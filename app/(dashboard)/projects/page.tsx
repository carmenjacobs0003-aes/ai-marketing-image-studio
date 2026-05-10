import { ProjectDashboard } from "@/components/projects/project-dashboard";
import { requireUser } from "@/lib/auth/session";
import {
  listBrandKits,
  listProjectImageGenerations,
  listProjectMarketingGenerations,
  listProjects
} from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProjectsPage() {
  const user = await requireUser("/projects");
  const supabase = createSupabaseServerClient();
  const [projects, brandKits, marketingHistory, imageHistory] =
    await Promise.all([
      listProjects(supabase, user.id),
      listBrandKits(supabase, user.id),
      listProjectMarketingGenerations(supabase, user.id),
      listProjectImageGenerations(supabase, user.id)
    ]);

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-cyan-300/20 bg-black/80 p-6 shadow-2xl shadow-cyan-500/10 ring-1 ring-white/10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Projects
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Saved campaign workspaces
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Save generated marketing content and images into reusable projects,
            edit campaign details, link brand kits, and review project history
            from a single futuristic dashboard.
          </p>
        </header>
        <ProjectDashboard
          brandKits={brandKits}
          imageHistory={imageHistory}
          marketingHistory={marketingHistory}
          projects={projects}
        />
      </div>
    </main>
  );
}
