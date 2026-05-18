import { FeaturePage } from "@/components/app-shell/feature-page";

export default function SettingsPage() {
  return (
    <FeaturePage
      eyebrow="settings"
      title="Workspace and connector settings"
      description="This page will hold household membership, sync schedule, bank connection health, and operational settings for the self-hosted deployment."
      cards={[
        {
          title: "Household setup",
          body: "Two logins, one shared household workspace, and explicit account-level ownership boundaries.",
        },
        {
          title: "Sync model",
          body: "Manual sync button plus scheduled DKB refreshes once the live connection is proven stable.",
        },
        {
          title: "Operational notes",
          body: "Environment variables, encrypted credentials storage later, backup documentation, and deployment runbooks.",
        },
      ]}
    />
  );
}
