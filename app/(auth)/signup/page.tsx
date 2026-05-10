import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { signUpWithPassword } from "@/app/(auth)/actions";

export default function SignupPage({ searchParams }: { searchParams: { error?: string; redirectTo?: string } }) {
  const redirectTo = searchParams.redirectTo ?? "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-white sm:px-6">
      <form action={signUpWithPassword} className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-cyan-950/30 sm:p-8">
        <div className="space-y-3 text-center sm:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Start creating</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Create your studio account</h1>
          <p className="text-sm leading-6 text-slate-300">Sign up with email and password. Supabase stores and refreshes your session securely with SSR cookies.</p>
        </div>
        {searchParams.error ? <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{searchParams.error}</p> : null}
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <label className="block space-y-2 text-sm font-medium">
          <span>Name</span>
          <input autoComplete="name" className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none ring-cyan-300 transition focus:border-cyan-300/70 focus:ring-2" name="fullName" type="text" required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>Email</span>
          <input autoComplete="email" className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none ring-cyan-300 transition focus:border-cyan-300/70 focus:ring-2" name="email" type="email" required />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>Password</span>
          <input autoComplete="new-password" className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none ring-cyan-300 transition focus:border-cyan-300/70 focus:ring-2" name="password" type="password" minLength={8} required />
        </label>
        <AuthSubmitButton pendingText="Creating account...">Create account</AuthSubmitButton>
        <p className="text-center text-sm text-slate-300">
          Already have an account? <Link className="font-semibold text-cyan-300 hover:text-cyan-200" href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}>Log in</Link>
        </p>
      </form>
    </main>
  );
}
