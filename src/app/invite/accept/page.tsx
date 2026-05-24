import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentViewer } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  hashInvitationToken,
  statusFor,
} from "@/lib/sharing/invitations";

import { acceptInvitationAction } from "./actions";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InviteAcceptPage({ searchParams }: Props) {
  const resolved = searchParams ? await searchParams : {};
  const token = firstValue(resolved.token);
  const error = firstValue(resolved.error);

  if (!token) {
    return (
      <>
        <PageHeader
          eyebrow="invite"
          title="Einladung"
          description="Der Link enthält keinen gültigen Einladungstoken."
        />
        <Card>
          <Badge variant="error" icon="error">Token fehlt im Link.</Badge>
        </Card>
      </>
    );
  }

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: {
      household: { select: { name: true } },
      createdByUser: { select: { displayName: true } },
    },
  });

  if (!invitation) {
    return (
      <>
        <PageHeader eyebrow="invite" title="Einladung" />
        <Card>
          <Badge variant="error" icon="error">Diese Einladung existiert nicht.</Badge>
        </Card>
      </>
    );
  }

  const status = statusFor(invitation);
  const viewer = await getCurrentViewer();

  return (
    <>
      <PageHeader
        eyebrow="invite"
        title={`Einladung in ${invitation.household.name}`}
        description={`Eingeladen von ${invitation.createdByUser.displayName}. Mit Annahme wirst du Mitglied des Haushalts und erhältst den vom Einladenden vorgesehenen Kontozugriff.`}
      />

      {error ? (
        <div className="mb-md">
          <Badge variant="error" icon="error">{error}</Badge>
        </div>
      ) : null}

      <Card>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-md mb-md">
          <Detail label="Status" value={statusBadge(status)} />
          <Detail
            label="Gültig bis"
            value={<span>{invitation.expiresAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span>}
          />
        </dl>

        {status === "active" ? (
          viewer ? (
            <form action={acceptInvitationAction}>
              <input type="hidden" name="token" value={token} />
              <Button variant="primary" type="submit" icon="check_circle">
                Einladung annehmen
              </Button>
            </form>
          ) : (
            <div className="space-y-md">
              <p className="text-body-sm text-on-surface-variant">
                Bitte einloggen oder registrieren, um die Einladung anzunehmen.
              </p>
              <Button
                as="link"
                href={`/settings?inviteToken=${encodeURIComponent(token)}`}
                variant="primary"
                icon="login"
              >
                Zu Einstellungen / Login
              </Button>
            </div>
          )
        ) : (
          <p className="text-body-sm text-on-surface-variant">
            Diese Einladung ist nicht mehr aktiv.
          </p>
        )}
      </Card>
    </>
  );
}

function statusBadge(status: "active" | "accepted" | "revoked" | "expired") {
  switch (status) {
    case "active":
      return <Badge variant="success" icon="check_circle">aktiv</Badge>;
    case "accepted":
      return <Badge variant="info">angenommen</Badge>;
    case "revoked":
      return <Badge variant="error" icon="cancel">widerrufen</Badge>;
    case "expired":
      return <Badge variant="neutral" icon="cancel">abgelaufen</Badge>;
  }
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-label-md text-on-surface-variant uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-xs text-body-md text-on-surface">{value}</dd>
    </div>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
