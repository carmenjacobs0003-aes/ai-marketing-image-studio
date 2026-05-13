import { BRAND_NAME } from "@/lib/branding";
export const metadata = {
  title: "Privacy Policy",
  description: `Privacy practices for ${BRAND_NAME}.`
};

export default function PrivacyPolicyPage() {
  return (
    <main className="aurora-shell min-h-screen px-4 py-16 sm:px-6 lg:px-8">
      <article className="page-container max-w-4xl">
        <section className="glass-card p-6 sm:p-10">
          <p className="eyebrow">Legal</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Effective date: May 11, 2026
          </p>
          <div className="mt-8 space-y-6 text-slate-300">
            <p>
              {BRAND_NAME} collects account, billing, usage, prompt, generated
              content, and support information needed to operate the service,
              secure accounts, process subscriptions, and improve product
              quality.
            </p>
            <p>
              We use trusted processors for hosting, authentication, payments,
              analytics, monitoring, database storage, and AI generation.
              Prompts and generated assets may be sent to AI providers only to
              fulfill your requests and enforce safety protections.
            </p>
            <p>
              We do not sell personal information. We retain customer data for
              as long as needed to provide the service, meet legal obligations,
              resolve disputes, prevent abuse, and maintain backups.
            </p>
            <p>
              You can request access, export, correction, or deletion of your
              personal information by contacting support from the email
              associated with your account. Some records may be retained where
              required for security, billing, tax, or legal compliance.
            </p>
            <p>
              Administrators should replace this starter policy with
              counsel-approved language before launch in regulated markets or
              for enterprise customers.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
