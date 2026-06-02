export interface Account {
  id: string; iban: string | null; name: string;
  account_type: 'giro' | 'savings' | 'joint';
  is_joint: boolean; balance_cents: number | null; owner_label: string | null;
}
export interface Transaction {
  id: string; account_id: string; booking_date: string; amount_cents: number;
  counterparty: string | null; purpose: string | null; counterparty_iban: string | null;
  category: string | null; category_group: string | null; is_internal: boolean;
}
export interface MonthlySeries { months: string[]; labels: string[]; }
