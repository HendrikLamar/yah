import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/db/prisma";
import { getViewerHouseholdContext } from "@/lib/household/viewer";

import {
  createShareableInviteAction,
  revokeAccountShareAction,
  shareAccountWithMemberAction,
} from "../../actions";

const FIELD_INPUT_CLASS =
  "w-full px-md py-sm bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-body-md text-on-surface";

type AccessPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccessPage({ params, searchParams }: AccessPageProps) {
  const context = await getViewerHouseholdContext();
  const resolvedParams = await params;
  const resolved = searchParams ? await searchParams : {};
  const inviteToken = firstValue(resolved.inviteToken);
  const error = firstValue(resolved.error);

  const account = await prisma.account.findFirst({
    where: { id: resolvedParams.id, householdId: context.householdId },
    include: {
      visibilityOwnerUser: { select: { id: true, displayName: true } },
      shares: {
        include: { sharedWithUser: { select: { id: true, displayName: true, email: true } } },
      },
    },
  });

  if (!account) notFound();

  const members = await prisma.householdMember.findMany({
    where: { householdId: context.householdId },
    include: { user: { select: { id: true, displayName: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const ownerUserId = account.visibilityOwnerUserId;
  const sharedUserIds = new Set(account.shares.map((s) => s.sharedWithUserId));
  const shareCandidates = members.filter(
    (m) =>
      m.userId !== ownerUserId &&
      m.userId !== context.viewer?.userId &&
      !sharedUserIds.has(m.userId),
  );

  const inviteUrl = inviteToken
    ? `/invite/accept?token=${encodeURIComponent(inviteToken)}`
    : null;

  return (
    <>
      <PageHeader
        eyebrow="accounts"
        title={`Zugriff: ${account.name}`}
        description="Wer kann dieses Konto sehen? Geteilte Konten sind für alle Haushaltsmitglieder sichtbar; sonst sind sie privat plus optionale per-Konto-Freigaben."
      />

      {error ? (
        <div className="mb-md">
          <Badge variant="error" icon="error">{error}</Badge>
        </div>
      ) : null}
      {inviteUrl ? (
        <Card className="mb-md">
          <h3 className="text-headline-sm text-on-surface mb-sm">Einladung erstellt</h3>
          <p className="text-body-sm text-on-surface-variant mb-sm">
            Diesen Link kopieren und an die andere Person schicken. Beim Öffnen wird der
            Empfänger zum Haushalt hinzugefügt und erhält Zugriff auf dieses Konto.
          </p>
          <code className="block bg-surface-container-low rounded-lg p-md text-body-sm break-all">
            {inviteUrl}
          </code>
        </Card>
      ) : null}

      <div className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 lg:col-span-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface mb-md">Aktueller Zugriff</h3>
            <ul className="space-y-sm">
              {account.visibilityOwnerType === "SHARED" ? (
                <li className="flex items-center justify-between bg-surface-container-low rounded-lg px-md py-sm">
                  <span className="text-body-sm text-on-surface">
                    Alle Haushaltsmitglieder
                  </span>
                  <Badge variant="info" icon="group">geteilt</Badge>
                </li>
              ) : null}
              {account.visibilityOwnerUser ? (
                <li className="flex items-center justify-between bg-surface-container-low rounded-lg px-md py-sm">
                  <span className="text-body-sm text-on-surface">
                    {account.visibilityOwnerUser.displayName}
                  </span>
                  <Badge variant="neutral" icon="lock">Besitzer</Badge>
                </li>
              ) : null}
              {account.shares.map((share) => (
                <li
                  key={share.id}
                  className="flex items-center justify-between bg-surface-container-low rounded-lg px-md py-sm"
                >
                  <span className="text-body-sm text-on-surface">
                    {share.sharedWithUser.displayName} · {share.sharedWithUser.email}
                  </span>
                  <div className="flex items-center gap-sm">
                    <Badge variant="success">VIEWER</Badge>
                    <form action={revokeAccountShareAction}>
                      <input type="hidden" name="shareId" value={share.id} />
                      <Button variant="ghost" size="sm" type="submit">
                        widerrufen
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
              {account.shares.length === 0 && account.visibilityOwnerType === "USER" ? (
                <li className="text-body-sm text-on-surface-variant">
                  Noch keine zusätzlichen Personen.
                </li>
              ) : null}
            </ul>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-6 space-y-md">
          {shareCandidates.length > 0 ? (
            <Card>
              <h3 className="text-headline-sm text-on-surface mb-md">
                Mit Haushaltsmitglied teilen
              </h3>
              <form action={shareAccountWithMemberAction} className="space-y-md">
                <input type="hidden" name="accountId" value={account.id} />
                <label className="block text-body-sm text-on-surface">
                  <span className="block mb-xs">Mitglied</span>
                  <select name="userId" required className={FIELD_INPUT_CLASS}>
                    {shareCandidates.map((c) => (
                      <option key={c.userId} value={c.userId}>
                        {c.user.displayName} ({c.user.email})
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="primary" type="submit" icon="group">
                  Zugriff geben
                </Button>
              </form>
            </Card>
          ) : null}

          <Card>
            <h3 className="text-headline-sm text-on-surface mb-md">
              Einladungslink generieren
            </h3>
            <p className="text-body-sm text-on-surface-variant mb-md">
              Erstellt einen Link, der dem Empfänger Haushaltsmitgliedschaft + Zugriff auf
              dieses Konto gewährt. E-Mail-Versand ist noch nicht eingebaut — den Link
              manuell kopieren.
            </p>
            <form action={createShareableInviteAction} className="space-y-md">
              <input type="hidden" name="accountId" value={account.id} />
              <label className="block text-body-sm text-on-surface">
                <span className="block mb-xs">Gültigkeit (Stunden)</span>
                <select name="expiryHours" defaultValue="24" className={FIELD_INPUT_CLASS}>
                  <option value="1">1 Stunde</option>
                  <option value="24">24 Stunden</option>
                  <option value="168">7 Tage</option>
                  <option value="720">30 Tage</option>
                </select>
              </label>
              <Button variant="secondary" type="submit" icon="mail">
                Link erstellen
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
