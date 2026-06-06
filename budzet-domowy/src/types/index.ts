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
  type: string;
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
  type: string; // income, expense, transfer
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

export interface RecurringTransaction {
  id: number;
  name: string;
  amount: number;
  category_id?: number;
  account_id?: number;
  frequency: string;
  next_date: string;
  day_of_month?: number;
  active: number;
}

export interface RecurringSuggestion {
  description: string;
  amount: number;
  category_id?: number;
  account_id: number;
  last_date: string;
}

export interface BackupData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  recurrings: RecurringTransaction[];
}
