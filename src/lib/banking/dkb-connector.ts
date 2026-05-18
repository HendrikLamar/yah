import {
  getDkbConnectionStatus,
  type DkbConnectionStatus,
} from "./dkb-config";
import type { BankConnector, BankConnectorDescriptor } from "./connector";

function mapStatus(status: DkbConnectionStatus): BankConnectorDescriptor {
  return {
    provider: "dkb",
    displayName: "DKB FinTS",
    status: status.state === "ready" ? "ready_for_test" : "missing_config",
    summary: status.summary,
    capabilities: {
      listsAccounts: true,
      fetchesBalances: true,
      fetchesTransactions: true,
      needsInteractiveTan: true,
    },
  };
}

export function getDkbConnectorDescriptor(
  env: Record<string, string | undefined>,
): BankConnectorDescriptor {
  return mapStatus(getDkbConnectionStatus(env));
}

export class PendingDkbConnector implements BankConnector {
  constructor(private readonly env: Record<string, string | undefined>) {}

  async getDescriptor(): Promise<BankConnectorDescriptor> {
    return getDkbConnectorDescriptor(this.env);
  }

  async validateConfiguration(): Promise<BankConnectorDescriptor> {
    return getDkbConnectorDescriptor(this.env);
  }

  async listAccounts(): Promise<import("./connector").ConnectedAccount[]> {
    throw new Error(
      "DKB live connection not executed yet. Run npm run dkb:test tonight to validate the connector.",
    );
  }

  async fetchBalances(): Promise<import("./connector").BalanceSnapshot[]> {
    throw new Error(
      "DKB live connection not executed yet. Run npm run dkb:test tonight to validate the connector.",
    );
  }

  async fetchTransactions(): Promise<import("./connector").ImportedTransaction[]> {
    throw new Error(
      "DKB live connection not executed yet. Run npm run dkb:test tonight to validate the connector.",
    );
  }
}
