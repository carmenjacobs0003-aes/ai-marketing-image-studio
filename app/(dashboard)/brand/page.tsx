import { BrandKitManager } from "@/components/brand/brand-kit-manager";
import { requireUser } from "@/lib/auth/session";
import { listBrandKits } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function BrandPage() {
  const user = await requireUser("/brand");
  const supabase = createSupabaseServerClient();
  const brandKits = await listBrandKits(supabase, user.id);

  return (
    <main className="p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-cyan-300/20 bg-black/80 p-6 shadow-2xl shadow-cyan-500/10 ring-1 ring-white/10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Brand
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Brand kits system
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Save brand names, colours, fonts, tone, logo references, and voice
            rules. Default or project-linked kits are automatically injected
            into marketing and image prompts.
          </p>
        </header>
        <BrandKitManager brandKits={brandKits} />
      </div>
    </main>
  );
}
