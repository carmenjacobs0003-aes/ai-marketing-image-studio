import { ImageLibraryGrid } from "@/components/images/image-library-grid";
import { requireUser } from "@/lib/auth/session";
import { listImageGenerations, listProjects } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withSignedImageUrls } from "@/lib/storage/images";

export default async function ImagesPage() {
  const user = await requireUser("/images");
  const supabase = createSupabaseServerClient();
  const [images, projects] = await Promise.all([
    listImageGenerations(supabase, user.id, 24),
    listProjects(supabase, user.id)
  ]);
  const imagesWithPreviews = await withSignedImageUrls(images);

  return (
    <main className="page-shell">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="page-hero">
          <p className="eyebrow">
            Images
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Generated image library
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Preview permanently stored Supabase assets, download campaign files,
            and attach finished concepts to active projects.
          </p>
        </header>
        <ImageLibraryGrid images={imagesWithPreviews} projects={projects} />
      </div>
    </main>
  );
}
