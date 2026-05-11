import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { signUpWithPassword } from "@/app/(auth)/actions";

export default function SignupPage({
  searchParams
}: {
  searchParams: { error?: string; redirectTo?: string };
}) {
  const redirectTo = searchParams.redirectTo ?? "/dashboard";

  return (
    <main className="aurora-shell flex min-h-screen items-center justify-center px-4 py-10 text-white sm:px-6">
      <form
        action={signUpWithPassword}
        className="glass-card relative z-10 w-full max-w-md space-y-6 p-6 sm:p-8"
      >
        <div className="space-y-3 text-center sm:text-left">
          <p className="eyebrow">Start creating</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Create your studio account
          </h1>
          <p className="text-sm leading-6 text-slate-300">
            Launch a premium black-glass workspace for AI visuals, copy, brand
            systems, projects, and billing.
          </p>
        </div>
        {searchParams.error ? (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {searchParams.error}
          </p>
        ) : null}
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <label className="block space-y-2 text-sm font-medium">
          <span>Name</span>
          <input
            autoComplete="name"
            className="field-control"
            name="fullName"
            type="text"
            required
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>Email</span>
          <input
            autoComplete="email"
            className="field-control"
            name="email"
            type="email"
            required
          />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>Password</span>
          <input
            autoComplete="new-password"
            className="field-control"
            name="password"
            type="password"
            minLength={8}
            required
          />
        </label>
        <AuthSubmitButton pendingText="Creating account...">
          Create account
        </AuthSubmitButton>
        <p className="text-center text-sm text-slate-300">
          Already have an account?{" "}
          <Link
            className="font-semibold text-cyan-300 hover:text-cyan-200"
            href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
          >
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
