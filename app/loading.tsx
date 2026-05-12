import { SyntrixLogo } from "@/components/brand/syntrix-logo";

export default function Loading() {
  return (
    <main className="aurora-shell flex min-h-screen items-center justify-center px-6 text-white">
      <div className="glass-card w-full max-w-md p-8 text-center">
        <SyntrixLogo className="justify-center" imageClassName="h-12" />
        <div className="mx-auto mt-6 h-12 w-12 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300 shadow-glow" />
        <p className="eyebrow mt-5">Loading SYNTRIX AI</p>
        <p className="mt-2 text-sm text-slate-300">
          Preparing your workspace...
        </p>
        <div className="mt-6 space-y-3">
          <div className="skeleton-line mx-auto h-3 w-3/4" />
          <div className="skeleton-line mx-auto h-3 w-1/2" />
        </div>
      </div>
    </main>
  );
}
