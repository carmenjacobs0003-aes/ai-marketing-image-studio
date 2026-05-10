"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="aurora-shell flex min-h-screen items-center justify-center px-6 text-white">
      <section className="glass-card max-w-xl p-8 text-center">
        <p className="eyebrow">System alert</p>
        <h2 className="mt-3 text-3xl font-black">Something went wrong</h2>
        <p className="mt-3 text-slate-300">{error.message}</p>
        <button className="neon-button mt-6" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
