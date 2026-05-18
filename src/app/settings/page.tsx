import { FeaturePage } from "@/components/app-shell/feature-page";
import { getCurrentViewer } from "@/lib/auth/session";

import { loginAction, logoutAction, registerAction } from "./actions";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const viewer = await getCurrentViewer();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const error = firstValue(resolvedSearchParams.error);
  const auth = firstValue(resolvedSearchParams.auth);

  return (
    <FeaturePage
      eyebrow="settings"
      title="Workspace, users and fallback import"
      description="User accounts now work with secure password hashes, demo data is seeded automatically, and CSV fallback import is ready if the DKB connection fails tonight."
      statusLabel={viewer ? `Signed in as ${viewer.displayName}` : "Ready for registration or login"}
      statusTone={viewer ? "success" : "warning"}
    >
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Current access state</h3>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            {viewer ? (
              <>
                <p>
                  Signed in as <strong className="text-slate-100">{viewer.displayName}</strong> ({viewer.email})
                </p>
                <p>
                  Active household: <strong className="text-slate-100">{viewer.householdName ?? "No household yet"}</strong>
                </p>
                <form action={logoutAction}>
                  <button className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950" type="submit">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <p>No user is currently signed in on this browser session.</p>
            )}
            {error ? (
              <p className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-rose-100">
                {error}
              </p>
            ) : null}
            {auth ? (
              <p className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-100">
                {authMessage(auth)}
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Demo access</h3>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <p>Seeded demo household with two users and sample transactions:</p>
            <ul className="space-y-2">
              <li>• hendrik@example.local / demo12345</li>
              <li>• frau@example.local / demo12345</li>
            </ul>
            <p>Only password hashes are stored in PostgreSQL; plain-text passwords are never persisted.</p>
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Register a new household</h3>
          <form action={registerAction} className="mt-4 space-y-4">
            <label className="block text-sm text-slate-300">
              Display name
              <input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" name="displayName" required />
            </label>
            <label className="block text-sm text-slate-300">
              E-mail
              <input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" name="email" required type="email" />
            </label>
            <label className="block text-sm text-slate-300">
              Password
              <input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" name="password" required type="password" minLength={8} />
            </label>
            <label className="block text-sm text-slate-300">
              Household name
              <input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" name="householdName" required />
            </label>
            <button className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950" type="submit">
              Create account and sign in
            </button>
          </form>
        </article>

        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Sign in</h3>
          <form action={loginAction} className="mt-4 space-y-4">
            <label className="block text-sm text-slate-300">
              E-mail
              <input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" name="email" required type="email" />
            </label>
            <label className="block text-sm text-slate-300">
              Password
              <input className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100" name="password" required type="password" />
            </label>
            <button className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950" type="submit">
              Sign in
            </button>
          </form>
        </article>
      </section>
    </FeaturePage>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function authMessage(auth: string): string {
  switch (auth) {
    case "registered":
      return "Account created successfully and session started.";
    case "logged-in":
      return "Signed in successfully.";
    case "logged-out":
      return "Signed out successfully.";
    default:
      return auth;
  }
}
