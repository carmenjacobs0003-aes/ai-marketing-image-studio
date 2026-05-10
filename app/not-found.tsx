import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="aurora-shell flex min-h-screen items-center justify-center px-6 text-white">
      <section className="glass-card max-w-xl p-8 text-center">
        <p className="eyebrow">404</p>
        <h1 className="mt-3 text-4xl font-black">Signal lost</h1>
        <p className="mt-3 text-slate-300">
          This route is outside the studio grid. Return to the dashboard to keep creating.
        </p>
        <Link className="neon-button mt-6" href="/dashboard">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
