import Link from "next/link";
import { signUpWithPassword } from "@/app/(auth)/actions";

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <form action={signUpWithPassword} className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Start creating</p>
          <h1 className="text-3xl font-bold">Create your studio account</h1>
          <p className="text-sm text-slate-300">Supabase Auth powers secure email/password accounts for your workspace.</p>
        </div>
        {searchParams.error ? <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{searchParams.error}</p> : null}
        <label className="block space-y-2 text-sm font-medium">
          <span>Name</span>
          <input className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none ring-cyan-300 focus:ring-2" name="fullName" type="text" required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>Email</span>
          <input className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none ring-cyan-300 focus:ring-2" name="email" type="email" required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>Password</span>
          <input className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none ring-cyan-300 focus:ring-2" name="password" type="password" minLength={8} required />
        </label>
        <button className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200" type="submit">
          Create account
        </button>
        <p className="text-center text-sm text-slate-300">
          Already have an account? <Link className="font-semibold text-cyan-300" href="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}
