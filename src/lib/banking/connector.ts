export type ConnectedAccountScope = "shared" | "owner";

export type ConnectedAccount = {
  id: string;
  externalId: string;
  displayName: string;
  ibanLast4?: string;
  currency: string;
  scope: ConnectedAccountScope;
  ownerDisplayName?: string;
};

export type ImportedTransaction = {
  id: string;
  accountId: string;
  bookingDate: string;
  amount: number;
  currency: string;
  counterpartyName?: string;
  purpose: string;
};

export type BalanceSnapshot = {
  accountId: string;
  amount: number;
  currency: string;
  capturedAt: string;
};

export type BankConnectorCapabilities = {
  listsAccounts: boolean;
  fetchesBalances: boolean;
  fetchesTransactions: boolean;
  needsInteractiveTan: boolean;
};

export type BankConnectionStatus = "missing_config" | "ready_for_test" | "untested";

export type BankConnectorDescriptor = {
  provider: "dkb";
  displayName: string;
  status: BankConnectionStatus;
  summary: string;
  capabilities: BankConnectorCapabilities;
};

export interface BankConnector {
  getDescriptor(): Promise<BankConnectorDescriptor>;
  validateConfiguration(): Promise<BankConnectorDescriptor>;
  listAccounts(): Promise<ConnectedAccount[]>;
  fetchBalances(): Promise<BalanceSnapshot[]>;
  fetchTransactions(days: number): Promise<ImportedTransaction[]>;
}
