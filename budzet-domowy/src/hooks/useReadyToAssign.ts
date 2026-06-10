import { useMemo } from "react";
import { useAccounts, useCategories, useTransactions, useAllBudgets } from "../lib/queries";

export function useReadyToAssign() {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const { data: budgets = [] } = useAllBudgets();

  const readyToAssign = useMemo(() => {
    if (accounts.length === 0) return 0;
    const totalAccounts = accounts.reduce((sum, a) => sum + a.balance, 0);

    const expenseCategories = categories.filter(c => c.type === "expense" || c.type === "both");

    const allMonths = new Set<string>();
    transactions.forEach(t => allMonths.add(t.date.slice(0, 7)));
    budgets.forEach(b => allMonths.add(b.month));
    const currentMonth = new Date().toISOString().slice(0, 7);
    allMonths.add(currentMonth);
    const sortedMonths = Array.from(allMonths).sort();

    const latestMonth = sortedMonths[sortedMonths.length - 1];
    if (!latestMonth) return totalAccounts;

    const states: Record<string, Record<number, { available: number }>> = {};
    for (const m of sortedMonths) {
      states[m] = {};
      for (const cat of expenseCategories) {
        states[m][cat.id] = { available: 0 };
      }
    }

    for (let i = 0; i < sortedMonths.length; i++) {
      const month = sortedMonths[i];
      const prevMonth = i > 0 ? sortedMonths[i-1] : null;

      for (const cat of expenseCategories) {
        const rollover = prevMonth ? Math.max(states[prevMonth][cat.id].available, 0) : 0;
        
        const assigned = budgets.find(b => b.category_id === cat.id && b.month === month)?.amount || 0;
        
        const activity = transactions
          .filter(t => t.category_id === cat.id && t.date.startsWith(month))
          .reduce((sum, t) => {
             if (t.type === 'expense') return sum + t.amount;
             if (t.type === 'income') return sum - t.amount;
             return sum;
          }, 0);

        states[month][cat.id] = {
          available: rollover + assigned - activity
        };
      }
    }

    const latestState = states[latestMonth] || {};
    let sumAvailable = 0;
    for (const cat of expenseCategories) {
      const avail = latestState[cat.id]?.available || 0;
      sumAvailable += avail;
    }

    return totalAccounts - sumAvailable;
  }, [accounts, categories, transactions, budgets]);

  return readyToAssign;
}
