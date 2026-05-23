import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
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
    <>
      <PageHeader
        eyebrow="settings"
        title="Workspace, users and fallback import"
        description="User accounts now work with secure password hashes, demo data is seeded automatically, and CSV fallback import is ready if the DKB connection fails tonight."
        status={{
          label: viewer ? `Signed in as ${viewer.displayName}` : "Ready for registration or login",
          variant: viewer ? "success" : "neutral",
        }}
      />

      <div className="grid grid-cols-12 gap-gutter mb-lg">
        <div className="col-span-12 lg:col-span-7">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Current access state</h3>
            <div className="mt-md space-y-sm text-body-sm text-on-surface">
              {viewer ? (
                <>
                  <p>
                    Signed in as <strong>{viewer.displayName}</strong> ({viewer.email})
                  </p>
                  <p>
                    Active household:{" "}
                    <strong>{viewer.householdName ?? "No household yet"}</strong>
                  </p>
                  <form action={logoutAction}>
                    <Button variant="ghost" size="sm" icon="logout" type="submit">
                      Sign out
                    </Button>
                  </form>
                </>
              ) : (
                <p>No user is currently signed in on this browser session.</p>
              )}
            </div>
            {error ? (
              <div className="mt-md">
                <Badge variant="error" icon="error">
                  {error}
                </Badge>
              </div>
            ) : null}
            {auth ? (
              <div className="mt-md">
                <Badge variant="success" icon="check_circle">
                  {authMessage(auth)}
                </Badge>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-5">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Demo access</h3>
            <div className="mt-md space-y-sm text-body-sm text-on-surface">
              <p>Seeded demo household with two users and sample transactions:</p>
              <ul className="space-y-xs font-mono text-[13px]">
                <li>hendrik@example.local / demo12345</li>
                <li>frau@example.local / demo12345</li>
              </ul>
              <p className="text-on-surface-variant">
                Only password hashes are stored in PostgreSQL; plain-text passwords are never
                persisted.
              </p>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Register a new household</h3>
            <form action={registerAction} className="mt-md space-y-md">
              <IconInput icon="badge" label="Display name" name="displayName" required />
              <IconInput icon="mail" label="E-mail" name="email" required type="email" />
              <IconInput
                icon="lock"
                label="Password"
                name="password"
                required
                type="password"
                minLength={8}
              />
              <IconInput icon="home" label="Household name" name="householdName" required />
              <Button variant="secondary" type="submit">
                Create account and sign in
              </Button>
            </form>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface">Sign in</h3>
            <form action={loginAction} className="mt-md space-y-md">
              <IconInput icon="mail" label="E-mail" name="email" required type="email" />
              <IconInput icon="lock" label="Password" name="password" required type="password" />
              <Button variant="primary" type="submit">
                Sign in
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

type IconInputProps = {
  icon: IconName;
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  minLength?: number;
};

function IconInput({ icon, label, name, type = "text", required, minLength }: IconInputProps) {
  return (
    <label className="block text-body-sm text-on-surface">
      {label}
      <div className="mt-xs relative">
        <Icon
          name={icon}
          className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
        />
        <input
          className="w-full pl-[48px] pr-md py-md bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-body-md text-on-surface"
          name={name}
          type={type}
          required={required}
          minLength={minLength}
        />
      </div>
    </label>
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
