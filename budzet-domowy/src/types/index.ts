export interface Account {
  id: number;
  name: string;
  type: string;
  currency: string;
  balance: number;
  color?: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  icon?: string;
  color?: string;
  type: "income" | "expense" | "transfer" | "both";
  parent_id?: number;
}

export interface Tag {
  id: number;
  name: string;
  color?: string;
}

export interface Transaction {
  id: number;
  account_id: number;
  category_id?: number;
  amount: number;
  type: "income" | "expense" | "transfer";
  description?: string;
  date: string;
  transfer_to_id?: number;
  created_at: string;
  updated_at: string;
  tags?: string[];
}

export interface Budget {
  id: number;
  category_id: number;
  month: string;
  amount: number;
}

export interface Goal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  icon?: string;
  color?: string;
  created_at: string;
}

/** Musi pozostać zsynchronizowane z `FREQUENCIES` w `src-tauri/src/db/recurring.rs`. */
export const RECURRING_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Co tydzień",
  monthly: "Co miesiąc",
  quarterly: "Co kwartał",
  yearly: "Co rok",
};

export interface RecurringTransaction {
  id: number;
  name: string;
  amount: number;
  category_id?: number;
  account_id?: number;
  frequency: RecurringFrequency;
  next_date: string;
  /** Nullable w bazie — zawsze sprawdzaj przed wywołaniem metod na tej wartości. */
  day_of_month?: number | null;
  active: number;
}

/** Wyliczony stan kategorii w budżecie ZBB dla danego miesiąca (liczony w Rust). */
export interface BudgetState {
  category_id: number;
  /** Nadwyżka przeniesiona z poprzedniego miesiąca (zawsze >= 0). */
  rollover: number;
  assigned: number;
  /** Wydatki minus zwroty. Dodatnia wartość = pieniądze wyszły. */
  activity: number;
  available: number;
  /** Debet z poprzedniego miesiąca (zawsze <= 0), pokryty z "Do Rozdysponowania". */
  overspent: number;
}

export interface RecurringSuggestion {
  description: string;
  amount: number;
  category_id?: number;
  account_id: number;
  last_date: string;
}
