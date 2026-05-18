export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 sm:px-10 lg:px-12">
        <section className="space-y-6">
          <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-300">
            Household Finance Manager · scaffold
          </span>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Self-hosted household finance for two people, starting with DKB.
            </h1>
            <p className="max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
              This scaffold focuses first on the risky part: validating a real DKB
              connection path before deeper importer and dashboard work.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Scope locked",
              body: "Private household finance manager, DKB only, self-hosted, shared plus personal accounts, no depot in MVP.",
            },
            {
              title: "Current milestone",
              body: "Connector spike with python-fints and a runnable DKB connection test harness.",
            },
            {
              title: "Next milestone",
              body: "Once DKB connectivity is proven, build the importer pipeline, categories, rules, and dashboard.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-black/20"
            >
              <h2 className="text-lg font-semibold text-slate-100">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">DKB connection test</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Fill in <code className="rounded bg-slate-800 px-1.5 py-0.5">.env.dkb.local</code>{" "}
              from the example file, then run the Python spike. The script will list
              accounts, fetch balances, try recent transactions, and prompt for TAN
              confirmation if required.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-2xl bg-black/40 p-4 text-sm text-emerald-200">
{`cd /home/pi/.hermes/hermes-agent/scratch/household-finance
source /home/pi/.hermes/hermes-agent/venv/bin/activate
cp .env.dkb.local.example .env.dkb.local
python scripts/dkb_connection_test.py`}
            </pre>
          </article>

          <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Planned MVP areas</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
              <li>• household + login model for two users</li>
              <li>• shared vs personal DKB accounts</li>
              <li>• imported transaction feed</li>
              <li>• categories and rule-based auto-tagging</li>
              <li>• monthly cashflow and category charts</li>
            </ul>
          </article>
        </section>
      </div>
    </main>
  );
}
