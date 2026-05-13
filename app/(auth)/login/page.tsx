import Link from "next/link";
import { SyntrixLogo } from "@/components/brand/syntrix-logo";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { signInWithPassword } from "@/app/(auth)/actions";
import { BRAND_NAME } from "@/lib/branding";

export default function LoginPage({
  searchParams
}: {
  searchParams: { error?: string; message?: string; redirectTo?: string };
}) {
  const redirectTo = searchParams.redirectTo ?? "/dashboard";

  return (
    <main className="aurora-shell flex min-h-screen items-center justify-center px-4 py-10 text-white sm:px-6">
      <form
        action={signInWithPassword}
        className="glass-card relative z-10 w-full max-w-md space-y-6 p-6 sm:p-8"
      >
        <div className="space-y-4 text-center sm:text-left">
          <SyntrixLogo className="block" />
          <p className="eyebrow">Welcome back</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Log in to {BRAND_NAME}
          </h1>
          <p className="text-sm leading-6 text-slate-300">
            Access your private workspace for campaigns, image history, brand
            assets, and billing.
          </p>
        </div>
        {searchParams.message ? (
          <p className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-100">
            {searchParams.message}
          </p>
        ) : null}
        {searchParams.error ? (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {searchParams.error}
          </p>
        ) : null}
        <input
          id="redirect-to"
          type="hidden"
          name="redirectTo"
          value={redirectTo}
        />
        <label className="block space-y-2 text-sm font-medium" htmlFor="email">
          <span>Email</span>
          <input
            autoComplete="email"
            id="email"
            className="field-control"
            name="email"
            type="email"
            required
          />
        </label>
        <label
          className="block space-y-2 text-sm font-medium"
          htmlFor="password"
        >
          <span>Password</span>
          <input
            autoComplete="current-password"
            id="password"
            className="field-control"
            name="password"
            type="password"
            minLength={8}
            required
          />
        </label>
        <AuthSubmitButton pendingText="Logging in...">Log in</AuthSubmitButton>
        <p className="text-center text-sm text-slate-300">
          New here?{" "}
          <Link
            className="font-semibold text-cyan-300 hover:text-cyan-200"
            href={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
          >
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}
