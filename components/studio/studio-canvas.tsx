type StudioCanvasProps = {
  usage: {
    imageGenerations: number;
    imageGenerationLimit: number;
    remainingImageGenerations: number;
  };
};

export function StudioCanvas({ usage }: StudioCanvasProps) {
  return (
    <main className="grid min-h-screen gap-6 bg-slate-950 p-8 text-white lg:grid-cols-[320px_1fr]">
      <aside className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Studio</p>
          <h1 className="mt-2 text-3xl font-bold">Generate an image</h1>
          <p className="mt-2 text-sm text-slate-300">Protected API generation stores outputs in your private Supabase bucket.</p>
        </div>
        <div className="rounded-xl border border-white/10 p-4">
          <p className="text-sm text-slate-300">Monthly usage</p>
          <p className="mt-1 text-2xl font-bold">{usage.imageGenerations}/{usage.imageGenerationLimit}</p>
          <p className="text-xs text-slate-400">{usage.remainingImageGenerations} generations remaining</p>
        </div>
        <form className="space-y-3">
          <label className="block space-y-2 text-sm font-medium">
            <span>Prompt</span>
            <textarea className="min-h-40 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none ring-cyan-300 focus:ring-2" placeholder="Describe a campaign-ready product image..." />
          </label>
          <button className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950" type="button">
            API ready: POST /api/images/generate
          </button>
        </form>
      </aside>
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex h-full min-h-[480px] items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-slate-300">
          Generated images will appear here after the client-side studio controls are connected.
        </div>
      </section>
    </main>
  );
}
