import Link from "next/link";
import { signInWithPassword } from "@/app/(auth)/actions";

export default function LoginPage({ searchParams }: { searchParams: { error?: string; redirectTo?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <form action={signInWithPassword} className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Welcome back</p>
          <h1 className="text-3xl font-bold">Log in to your studio</h1>
          <p className="text-sm text-slate-300">Access protected projects, usage history, and AI image generation.</p>
        </div>
        {searchParams.error ? <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{searchParams.error}</p> : null}
        <input type="hidden" name="redirectTo" value={searchParams.redirectTo ?? "/dashboard"} />
        <label className="block space-y-2 text-sm font-medium">
          <span>Email</span>
          <input className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none ring-cyan-300 focus:ring-2" name="email" type="email" required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>Password</span>
          <input className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none ring-cyan-300 focus:ring-2" name="password" type="password" minLength={8} required />
        </label>
        <button className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200" type="submit">
          Log in
        </button>
        <p className="text-center text-sm text-slate-300">
          New here? <Link className="font-semibold text-cyan-300" href="/signup">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
