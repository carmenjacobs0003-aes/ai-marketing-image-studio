export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="rounded-3xl border border-cyan-300/20 bg-white/[0.04] p-8 text-center shadow-2xl shadow-cyan-950/30">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Loading</p>
        <p className="mt-2 text-sm text-slate-300">Preparing your studio session...</p>
      </div>
    </main>
  );
}
