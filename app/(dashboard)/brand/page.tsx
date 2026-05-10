import { BrandKitManager } from "@/components/brand/brand-kit-manager";
import { requireUser } from "@/lib/auth/session";
import { listBrandKits } from "@/lib/db/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function BrandPage() {
  const user = await requireUser("/brand");
  const supabase = createSupabaseServerClient();
  const brandKits = await listBrandKits(supabase, user.id);

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-hero">
          <p className="eyebrow">
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
