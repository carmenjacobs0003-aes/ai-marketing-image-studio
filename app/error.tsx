"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="p-8">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="mt-2 text-slate-300">{error.message}</p>
      <button className="mt-4 rounded bg-brand-500 px-4 py-2" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
