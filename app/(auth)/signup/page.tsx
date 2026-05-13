import Link from "next/link";
import { SyntrixLogo } from "@/components/brand/syntrix-logo";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { signUpWithPassword } from "@/app/(auth)/actions";
import { BRAND_NAME } from "@/lib/branding";

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
        <div className="space-y-4 text-center sm:text-left">
          <SyntrixLogo className="block" />
          <p className="eyebrow">Create account</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Create your {BRAND_NAME} account
          </h1>
          <p className="text-sm leading-6 text-slate-300">
            Create a private workspace for AI visuals, campaign content, brand
            systems, gallery, and billing.
          </p>
        </div>
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
        <label
          className="block space-y-2 text-sm font-medium"
          htmlFor="full-name"
        >
          <span>Name</span>
          <input
            autoComplete="name"
            id="full-name"
            className="field-control"
            name="fullName"
            type="text"
            required
          />
        </label>
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
            autoComplete="new-password"
            id="password"
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
