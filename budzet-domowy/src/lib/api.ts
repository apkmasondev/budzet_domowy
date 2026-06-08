import { invoke } from "@tauri-apps/api/core";
import { Account, Category, Transaction, Budget, Goal, RecurringTransaction, RecurringSuggestion, Tag } from "../types";

export const api = {
  getAccounts: () => invoke<Account[]>("get_accounts"),
  createAccount: (payload: Omit<Account, 'id' | 'created_at'>) => invoke<number>("create_account", { payload }),
  deleteAccount: (id: number) => invoke<void>("delete_account", { id }),
  
  getCategories: () => invoke<Category[]>("get_categories"),
  createCategory: (name: string, type: string, color?: string) => invoke<number>("create_category", { name, type, color }),
  deleteCategory: (id: number) => invoke<void>("delete_category", { id }),
  
  getTransactions: () => invoke<Transaction[]>("get_transactions"),
  createTransaction: (payload: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => invoke<number>("create_transaction", { payload }),
  updateTransaction: (id: number, payload: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => invoke<void>("update_transaction", { id, payload }),
  deleteTransaction: (id: number) => invoke<void>("delete_transaction", { id }),
  bulkInsertTransactions: (payloads: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>[]) => invoke<number>("bulk_insert_transactions", { payloads }),

  getTags: () => invoke<Tag[]>("get_tags"),

  getBudgets: (month: string) => invoke<Budget[]>("get_budgets", { month }),
  getAllBudgets: () => invoke<Budget[]>("get_all_budgets"),
  upsertBudget: (payload: { category_id: number; month: string; amount: number }) => invoke<void>("upsert_budget", { payload }),
  copyBudgetsToMonth: (fromMonth: string, toMonth: string) => invoke<void>("copy_budgets_to_month", { fromMonth, toMonth }),

  getGoals: () => invoke<Goal[]>("get_goals"),
  createGoal: (payload: Omit<Goal, 'id' | 'current_amount' | 'created_at'>) => invoke<number>("create_goal", { payload }),
  deleteGoal: (id: number) => invoke<void>("delete_goal", { id }),
  addToGoal: (payload: { goal_id: number; amount: number; account_id: number; date: string }) => invoke<void>("add_to_goal", { payload }),

  getRecurrings: () => invoke<RecurringTransaction[]>("get_recurrings"),
  createRecurring: (payload: Omit<RecurringTransaction, 'id' | 'active'>) => invoke<number>("create_recurring", { payload }),
  deleteRecurring: (id: number) => invoke<void>("delete_recurring", { id }),
  processRecurrings: () => invoke<number>("process_recurrings"),
  detectSuggestions: () => invoke<RecurringSuggestion[]>("detect_suggestions"),
  ignoreSubscriptionSuggestion: (description: string) => invoke<void>("ignore_subscription_suggestion", { description }),

  exportDb: (destinationPath: string) => invoke<void>("export_db", { destinationPath }),
  importDb: (sourcePath: string) => invoke<void>("import_db", { sourcePath }),

  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
  factoryReset: () => invoke<void>("factory_reset"),
};
