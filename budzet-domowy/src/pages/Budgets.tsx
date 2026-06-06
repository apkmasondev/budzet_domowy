import { useState, useMemo } from "react";
import { useDialogStore } from "../store/useDialogStore";
import { Copy, Info } from "lucide-react";
import { useAccounts, useCategories, useTransactions, useAllBudgets, useUpsertBudget, useCopyBudgets } from "../lib/queries";

export default function Budgets() {
  const { showConfirm } = useDialogStore();
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const { data: budgets = [], isLoading } = useAllBudgets();
  
  const upsertBudgetMutation = useUpsertBudget();
  const copyBudgetsMutation = useCopyBudgets();

  const expenseCategories = categories.filter(c => c.type === "expense" || c.type === "both");

  const sortedMonths = useMemo(() => {
    const allMonths = new Set<string>();
    transactions.forEach(t => allMonths.add(t.date.slice(0, 7)));
    budgets.forEach(b => allMonths.add(b.month));
    allMonths.add(selectedMonth);
    allMonths.add(new Date().toISOString().slice(0, 7)); // Current month
    return Array.from(allMonths).sort();
  }, [transactions, budgets, selectedMonth]);

  const categoryStates = useMemo(() => {
    const states: Record<string, Record<number, { rollover: number; assigned: number; activity: number; available: number }>> = {};
    
    // Initialize
    for (const m of sortedMonths) {
      states[m] = {};
      for (const cat of expenseCategories) {
        states[m][cat.id] = { rollover: 0, assigned: 0, activity: 0, available: 0 };
      }
    }

    // Calculate sequentially
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

        const available = rollover + assigned - activity;

        states[month][cat.id] = { rollover, assigned, activity, available };
      }
    }
    return states;
  }, [transactions, budgets, expenseCategories, sortedMonths]);

  const readyToAssign = useMemo(() => {
    if (accounts.length === 0) return 0;
    const totalAccounts = accounts.reduce((sum, a) => sum + a.balance, 0);
    
    const latestMonth = sortedMonths[sortedMonths.length - 1];
    if (!latestMonth) return totalAccounts;
    
    const latestState = categoryStates[latestMonth] || {};
    let sumPositiveAvailable = 0;
    for (const cat of expenseCategories) {
      const avail = latestState[cat.id]?.available || 0;
      if (avail > 0) sumPositiveAvailable += avail;
    }
    
    return totalAccounts - sumPositiveAvailable;
  }, [accounts, categoryStates, expenseCategories, sortedMonths]);

  const handleInlineSave = async (categoryId: number, value: string) => {
    const amount = parseFloat(value) || 0;
    const currentAssigned = categoryStates[selectedMonth]?.[categoryId]?.assigned || 0;
    if (Math.abs(currentAssigned - amount) > 0.001) {
       await upsertBudgetMutation.mutateAsync({ category_id: categoryId, month: selectedMonth, amount });
    }
  };

  const handleCopy = async () => {
    const [year, month] = selectedMonth.split('-');
    let prevMonth = parseInt(month) - 1;
    let prevYear = parseInt(year);
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevMonthStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
    
    showConfirm(
      "Kopiowanie budżetów",
      `Czy na pewno chcesz skopiować przypisane kwoty z miesiąca ${prevMonthStr}?`,
      async () => {
        await copyBudgetsMutation.mutateAsync({ fromMonth: prevMonthStr, toMonth: selectedMonth });
      }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budżety miesięczne (ZBB)</h1>
          <p className="text-muted-foreground mt-1 text-sm">Nadaj każdej złotówce jej własne zadanie.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
          />
          <button 
            onClick={handleCopy}
            title="Skopiuj limity z poprzedniego miesiąca"
            className="bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors shadow-sm flex items-center gap-2"
          >
            <Copy size={16} /> Skopiuj poprzednie
          </button>
        </div>
      </div>

      {/* Ready To Assign Card */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-8 text-center relative overflow-hidden flex flex-col items-center justify-center">
        <div className="relative z-10">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
            Do Rozdysponowania 
            <div className="group relative">
              <Info size={14} className="text-muted-foreground hover:text-foreground cursor-help transition-colors" />
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-left font-normal">
                Kwota "Do Rozdysponowania" (Ready to Assign) to Twoja rzeczywista gotówka ze wszystkich kont pomniejszona o sumę środków już przypisanych do kategorii we wszystkich miesiącach. Jeśli jest ujemna, zaplanowałeś wydać więcej, niż masz!
              </div>
            </div>
          </h2>
          <div className={`text-6xl font-black tracking-tight drop-shadow-sm transition-colors duration-500 ${readyToAssign > 0.01 ? 'text-emerald-500' : readyToAssign < -0.01 ? 'text-red-500' : 'text-foreground'}`}>
            {readyToAssign.toFixed(2)} <span className="text-3xl font-bold opacity-50">PLN</span>
          </div>
          <p className="text-base font-medium mt-4 text-muted-foreground max-w-sm mx-auto">
            {readyToAssign > 0.01 ? "Przypisz te środki do swoich kategorii." : readyToAssign < -0.01 ? "Przypisano więcej gotówki niż posiadasz! Zmniejsz przydziały." : "Każda złotówka ma swoje zadanie. Świetna robota!"}
          </p>
        </div>
      </div>

      {/* Budgets Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <span className="text-muted-foreground animate-pulse font-medium">Przeliczanie budżetów...</span>
          </div>
        )}
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Kategoria</th>
                <th className="px-6 py-4 text-right">Z Poprzedniego</th>
                <th className="px-6 py-4 text-right">Przypisano</th>
                <th className="px-6 py-4 text-right">Wydano</th>
                <th className="px-6 py-4 text-right">Dostępne</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenseCategories.map(category => {
                const state = categoryStates[selectedMonth]?.[category.id] || { rollover: 0, assigned: 0, activity: 0, available: 0 };
                
                return (
                  <tr key={`${category.id}-${selectedMonth}`} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: category.color || '#ccc' }}></div>
                        <span className="font-semibold text-foreground">{category.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-muted-foreground font-medium bg-muted/30 px-2 py-1 rounded-md">
                        {state.rollover > 0 ? `+${state.rollover.toFixed(2)}` : '0.00'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-flex items-center group-hover:scale-105 transition-transform duration-200">
                         <input
                           type="number"
                           step="0.01"
                           className="bg-card border border-border hover:border-primary/50 hover:bg-muted/20 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg pl-2 pr-7 py-1.5 text-right w-28 font-bold transition-all outline-none shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                           defaultValue={state.assigned.toFixed(2)}
                           onBlur={(e) => handleInlineSave(category.id, e.target.value)}
                           onKeyDown={(e) => { if(e.key === 'Enter') e.currentTarget.blur() }}
                           disabled={upsertBudgetMutation.isPending}
                         />
                         <span className="absolute right-2 text-xs font-semibold text-muted-foreground/70 pointer-events-none">zł</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <span className={state.activity > 0 ? "text-red-500 font-semibold" : "text-muted-foreground font-medium"}>
                         {state.activity > 0 ? `-${state.activity.toFixed(2)}` : '0.00'}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-black px-4 py-1.5 rounded-full inline-block min-w-[100px] text-center shadow-sm ${state.available > 0 ? 'bg-emerald-500 text-white' : state.available < 0 ? 'bg-red-500 text-white' : 'bg-muted/50 text-muted-foreground border border-border'}`}>
                        {state.available.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
