import { TemplateGallery } from "@/components/templates/template-gallery";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function TemplatesPage() {
  const user = await requireUser("/templates");
  const profile = await getProfile(createSupabaseServerClient(), user.id);

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-hero">
          <p className="eyebrow">Templates</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Campaign templates
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Use social, email, SEO, and industry presets to shape outputs
            without rebuilding prompts. Advanced templates are available on Pro
            and Agency.
          </p>
        </header>
        <TemplateGallery plan={profile?.plan ?? "free"} />
      </div>
    </main>
  );
}
