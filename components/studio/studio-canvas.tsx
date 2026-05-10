type StudioCanvasProps = {
  usage: {
    imageGenerations: number;
    imageGenerationLimit: number;
    remainingImageGenerations: number;
  };
};

export function StudioCanvas({ usage }: StudioCanvasProps) {
  return (
    <main className="grid gap-6 p-4 text-white sm:p-6 lg:grid-cols-[320px_1fr] lg:p-8">
      <aside className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-cyan-950/20">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Studio</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Generate an image</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">Protected API generation stores outputs in your private Supabase bucket.</p>
        </div>
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
          <p className="text-sm text-cyan-100">Monthly usage</p>
          <p className="mt-1 text-2xl font-black">{usage.imageGenerations}/{usage.imageGenerationLimit}</p>
          <p className="text-xs text-slate-300">{usage.remainingImageGenerations} generations remaining</p>
        </div>
        <form className="space-y-3">
          <label className="block space-y-2 text-sm font-medium">
            <span>Prompt</span>
            <textarea className="min-h-40 w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none ring-cyan-300 transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2" placeholder="Describe a campaign-ready product image..." />
          </label>
          <button className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200" type="button">
            API ready: POST /api/images/generate
          </button>
        </form>
      </aside>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
        <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-cyan-300/30 bg-black text-center text-slate-300">
          Generated images will appear here after the client-side studio controls are connected.
        </div>
      </section>
    </main>
  );
}
