export const metadata = {
  title: "Terms of Service",
  description: "Terms for using SYNTRIX AI."
};

export default function TermsPage() {
  return (
    <main className="aurora-shell min-h-screen px-4 py-16 sm:px-6 lg:px-8">
      <article className="page-container max-w-4xl">
        <section className="glass-card p-6 sm:p-10">
          <p className="eyebrow">Legal</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Effective date: May 11, 2026
          </p>
          <div className="mt-8 space-y-6 text-slate-300">
            <p>
              By using SYNTRIX AI, you agree to use the platform lawfully, keep
              your credentials secure, and ensure that prompts, brand assets,
              and generated outputs comply with applicable laws and third-party
              rights.
            </p>
            <p>
              You retain ownership of your inputs and generated campaign
              materials to the extent permitted by law and provider terms. You
              grant us the rights needed to host, process, display, and transmit
              content for service delivery.
            </p>
            <p>
              You may not use the service to create illegal, deceptive,
              infringing, abusive, or unsafe content, bypass rate limits, probe
              infrastructure, or interfere with other customers.
            </p>
            <p>
              Paid plans renew until cancelled. Fees are non-refundable except
              where required by law or stated in a separate written agreement.
              Service availability may vary during maintenance, incidents, or
              third-party provider outages.
            </p>
            <p>
              This starter terms page should be reviewed and customized by
              qualified counsel before production launch.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
