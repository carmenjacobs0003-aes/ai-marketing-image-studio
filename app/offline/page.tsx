import Link from "next/link";
import { SyntrixLogo } from "@/components/brand/syntrix-logo";

export default function OfflinePage() {
  return (
    <main className="aurora-shell flex min-h-screen items-center justify-center p-6">
      <section className="glass-card max-w-xl p-8 text-center">
        <SyntrixLogo className="block text-center" />
        <p className="eyebrow mt-6">Offline mode</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
          You are offline
        </h1>
        <p className="mt-4 text-slate-300">
          AI generation and account data need a network connection, but
          installed app shells and key pages are cached so you can keep planning
          until you are back online.
        </p>
        <Link className="neon-button mt-8" href="/">
          Try again
        </Link>
      </section>
    </main>
  );
}
