import { requireUser } from "@/lib/auth/session";
import { listBrandKits } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function BrandPage() {
  const user = await requireUser("/brand");
  const supabase = createSupabaseServerClient();
  const brandKits = await listBrandKits(supabase, user.id);

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Brand
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Brand system
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Centralize brand voice, colors, products, and visual rules for typed
            generation workflows.
          </p>
        </header>
        <section className="grid gap-4 md:grid-cols-2">
          {brandKits.length ? (
            brandKits.map((brandKit) => (
              <article
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"
                key={brandKit.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <h2 className="text-xl font-black text-cyan-300">
                    {brandKit.name}
                  </h2>
                  {brandKit.is_default ? (
                    <span className="rounded-full border border-cyan-300/30 px-3 py-1 text-xs font-semibold text-cyan-100">
                      Default
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  {brandKit.voice ?? "No voice guidelines yet."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {brandKit.colors.length ? (
                    brandKit.colors.map((color) => (
                      <span
                        className="rounded-full border border-white/10 bg-black px-3 py-1 text-xs text-slate-200"
                        key={color}
                      >
                        {color}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">
                      No colors saved
                    </span>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-slate-300 md:col-span-2">
              <h2 className="text-xl font-black text-white">
                No brand kits yet
              </h2>
              <p className="mt-2 text-sm">
                Create brand kits through the typed database helpers or Supabase
                dashboard to power project, marketing, and image generations.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
