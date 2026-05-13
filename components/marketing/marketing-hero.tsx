import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { SyntrixLogo } from "@/components/brand/syntrix-logo";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/branding";

const stats = [
  "Cinematic AI visuals",
  "Brand-safe copy",
  "Private creative operating system"
];

export function MarketingHero() {
  return (
    <main className="aurora-shell flex min-h-screen flex-col px-4 text-white sm:px-6 lg:px-8">
      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 py-5 sm:py-6">
        <Link aria-label={`${BRAND_NAME} home`} href="/">
          <SyntrixLogo priority imageClassName="h-11 sm:h-12" />
        </Link>
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-2 sm:gap-3"
        >
          <Link
            className="ghost-button hidden px-4 py-2 text-sm sm:inline-flex"
            href="/gallery"
          >
            Gallery
          </Link>
          <Link className="ghost-button px-4 py-2 text-sm" href="/login">
            Sign in
          </Link>
          <Link className="neon-button px-4 py-2 text-sm" href="/signup">
            Enter
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-start gap-10 pb-14 pt-[clamp(2.5rem,10vh,7rem)] sm:pb-16 md:pt-[clamp(3rem,12vh,8rem)] lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] lg:gap-12 lg:pb-20">
        <div className="max-w-3xl text-center lg:text-left">
          <p className="mx-auto mb-5 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100 shadow-glow backdrop-blur-xl sm:text-sm lg:mx-0">
            {BRAND_TAGLINE}
          </p>
          <h1 className="text-balance text-4xl font-black tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl">
            Generate cinematic visual assets in{" "}
            <span className="text-cyan-300 drop-shadow-[0_0_28px_rgba(34,211,238,0.6)]">
              minutes
            </span>
            .
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg lg:mx-0 lg:text-xl">
            {BRAND_NAME} is a private creative operating system for cinematic
            image generation, campaign copy, brand systems, gallery, and
            billing.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link className="neon-button" href="/signup">
              Start creating <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link className="ghost-button" href="/pricing">
              View pricing
            </Link>
            <Link className="ghost-button" href="/gallery">
              View gallery
            </Link>
          </div>
        </div>

        <div className="glass-card glass-hover w-full p-4 sm:p-6 lg:mt-4">
          <div className="rounded-[2rem] border border-cyan-300/20 bg-black/70 p-5 shadow-glow">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="eyebrow">Generation workspace</p>
                <h2 className="mt-2 text-2xl font-black">
                  Cinematic asset board
                </h2>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-300 text-black shadow-glow">
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

      <footer className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-sm text-slate-400 sm:flex-row">
        <SyntrixLogo imageClassName="h-8" />
        <p>
          © {new Date().getFullYear()} {BRAND_NAME}. Creative system online.
        </p>
      </footer>
    </main>
  );
}
