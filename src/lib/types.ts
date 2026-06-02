export interface Account {
  id: string; iban: string | null; name: string;
  account_type: 'giro' | 'savings' | 'joint';
  is_joint: boolean; balance_cents: number | null; owner_label: string | null;
  display_name: string | null;
  member_count?: number; // number of account_members; shared badge = > 1
}

export type MembershipRole = 'owner' | 'member';

export interface AccountMember {
  account_id: string; user_id: string; role: MembershipRole; created_at: string;
}
export interface AccountInvitation {
  id: string; account_id: string; inviter_id: string; invitee_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  created_at: string; responded_at: string | null;
}
// Row from list_account_members RPC.
export interface MemberInfo { user_id: string; email: string; role: MembershipRole; }
// Row from my_invitations RPC (incoming, pending).
export interface IncomingInvitation {
  invitation_id: string; account_id: string; account_label: string;
  inviter_email: string; created_at: string;
}
// Row from list_account_invitations RPC (outgoing, pending — owner view).
export interface OutgoingInvitation {
  invitation_id: string; invitee_email: string; created_at: string;
}
// One account row on /accounts, enriched with the viewer's role and sharing state.
export interface SharedAccountCard {
  account: Account;
  viewerRole: MembershipRole;
  members: MemberInfo[];
  pending: OutgoingInvitation[]; // outgoing invites (owner only; [] for members)
}
export interface Transaction {
  id: string; account_id: string; booking_date: string; amount_cents: number;
  counterparty: string | null; purpose: string | null; counterparty_iban: string | null;
  category: string | null; category_group: string | null; is_internal: boolean;
}
export interface MonthlySeries { months: string[]; labels: string[]; }

export type AccountRole = 'giro' | 'tages' | 'joint';

// A slimmed transaction for the client view layer (amounts already in EUR).
export interface SlimTx { d: string; mo: string; e: string; z: string; a: number; c: string; int: 0 | 1; }

// One renderable tab: a single account's metrics, charts data and transactions.
export interface AccountView {
  id: string;
  role: AccountRole;
  label: string;       // display_name ?? name
  shared: boolean;     // derived from is_joint
  iban: string;        // masked
  n: number;           // transaction count
  now: number;         // current balance, EUR
  start: number; end: number; net: number;  // year-anchored balance change
  series: number[];    // 12 month-end balances, EUR
  months: string[]; mlabels: string[];
  income: number; expenses: number; net_op: number;  // year totals, EUR
  inc_m: number[]; exp_m: number[];                  // 12-month income/expense, EUR
  cat_total: Record<string, number>;                 // expenses by category, EUR
  cat_month: Record<string, number[]>;
  tx: SlimTx[];
}

export interface ConsolidatedAccountRef { id: string; label: string; role: AccountRole; balance: number; net: number; }

// The household tab: every account combined (internal transfers already netted).
export interface ConsolidatedView {
  months: string[]; mlabels: string[];
  total_balance: number;
  income: number; expenses: number; net_op: number;
  inc_m: number[]; exp_m: number[];
  cat_total: Record<string, number>;
  cat_month: Record<string, number[]>;
  accounts: ConsolidatedAccountRef[];
  tx: (SlimTx & { acct: string })[];
}

export interface DashboardData {
  meta: { year: number; n_total: number; n_accounts: number; total_balance: number };
  accounts: AccountView[];
  consolidated: ConsolidatedView | null;
}
