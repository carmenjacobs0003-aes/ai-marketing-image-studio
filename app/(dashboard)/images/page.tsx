import { requireUser } from "@/lib/auth/session";
import { listImageGenerations } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ImagesPage() {
  const user = await requireUser("/images");
  const supabase = createSupabaseServerClient();
  const images = await listImageGenerations(supabase, user.id, 24);

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Images
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Generated image library
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Review protected generation records tied to your authenticated
            Supabase user.
          </p>
        </header>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.length ? (
            images.map((image) => (
              <article
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
                key={image.id}
              >
                <div className="mb-4 flex aspect-video items-center justify-center rounded-xl border border-dashed border-cyan-300/20 bg-black text-sm text-slate-400">
                  {image.storage_path
                    ? "Private asset stored"
                    : "Pending asset"}
                </div>
                <h2 className="line-clamp-2 font-semibold">{image.prompt}</h2>
                <p className="mt-2 text-sm capitalize text-cyan-300">
                  {image.status}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(image.created_at).toLocaleString()}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-slate-300 sm:col-span-2 lg:col-span-3">
              No generated images yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
