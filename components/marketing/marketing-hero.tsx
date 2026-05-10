import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

const stats = ["Cinematic AI visuals", "Brand-safe copy", "Premium SaaS workspace"];

export function MarketingHero() {
  return (
    <main className="aurora-shell flex min-h-screen items-center px-4 py-12 text-white sm:px-6 lg:px-8">
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.8fr]">
        <div className="text-center lg:text-left">
          <p className="mx-auto mb-5 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-glow backdrop-blur-xl lg:mx-0">
            AI Marketing & Image Content Studio SaaS
          </p>
          <h1 className="text-5xl font-black tracking-tight sm:text-7xl lg:text-8xl">
            Generate campaign-ready visuals in{" "}
            <span className="text-cyan-300 drop-shadow-[0_0_28px_rgba(34,211,238,0.6)]">
              minutes
            </span>
            .
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 lg:text-xl">
            A premium black-glass studio for AI image generation, marketing copy,
            brand kits, templates, projects, billing, and protected SaaS workflows.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:justify-start">
            <Link className="neon-button" href="/signup">
              Start creating <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link className="ghost-button" href="/pricing">
              View pricing
            </Link>
          </div>
        </div>

        <div className="glass-card glass-hover p-4 sm:p-6">
          <div className="rounded-[2rem] border border-cyan-300/20 bg-black/70 p-5 shadow-glow">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="eyebrow">Live generation</p>
                <h2 className="mt-2 text-2xl font-black">Neon campaign board</h2>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300 text-black shadow-glow">
                <Sparkles className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {stats.map((stat, index) => (
                <div
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/50 hover:bg-cyan-300/[0.06]"
                  key={stat}
                >
                  <p className="text-xs text-slate-400">0{index + 1}</p>
                  <p className="mt-1 font-semibold text-white">{stat}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
