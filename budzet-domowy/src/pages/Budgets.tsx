import { useState, useMemo } from "react";
import { useDialogStore } from "../store/useDialogStore";
import { Copy, Info, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { useCategories, useUpsertBudget, useCopyBudgets, useBudgetStates, useReadyToAssignData } from "../lib/queries";

export default function Budgets() {
  const { showConfirm } = useDialogStore();
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const { data: categories = [] } = useCategories();
  const { data: readyToAssign = 0 } = useReadyToAssignData();
  const { data: budgetStatesArray = [], isLoading } = useBudgetStates(selectedMonth);
  
  const upsertBudgetMutation = useUpsertBudget();
  const copyBudgetsMutation = useCopyBudgets();

  const expenseCategories = categories.filter(c => c.type === "expense" || c.type === "both");

  const categoryStates = useMemo(() => {
    const states: Record<number, { rollover: number; assigned: number; activity: number; available: number; overspent?: number }> = {};
    for (const st of budgetStatesArray) {
      states[st.category_id] = st;
    }
    return states;
  }, [budgetStatesArray]);

  const [sortBy, setSortBy] = useState<"name" | "rollover" | "assigned" | "activity" | "available">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  };

  const sortedCategories = useMemo(() => {
    const list = [...expenseCategories];
    list.sort((a, b) => {
      const stateA = categoryStates[a.id] || { rollover: 0, assigned: 0, activity: 0, available: 0, overspent: 0 };
      const stateB = categoryStates[b.id] || { rollover: 0, assigned: 0, activity: 0, available: 0, overspent: 0 };
      
      let valA: any = 0;
      let valB: any = 0;
      
      if (sortBy === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortBy === "rollover") {
        valA = stateA.rollover;
        valB = stateB.rollover;
      } else if (sortBy === "assigned") {
        valA = stateA.assigned;
        valB = stateB.assigned;
      } else if (sortBy === "activity") {
        valA = stateA.activity;
        valB = stateB.activity;
      } else if (sortBy === "available") {
        valA = stateA.available;
        valB = stateB.available;
      }
      
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [expenseCategories, sortBy, sortOrder, categoryStates]);

  const renderSortableHeader = (label: string, field: typeof sortBy, alignRight: boolean = false) => {
    const isCurrent = sortBy === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        className={`px-6 py-4 cursor-pointer select-none hover:bg-muted/80 transition-colors sticky top-0 z-20 bg-card border-b border-border shadow-sm group ${alignRight ? 'text-right' : 'text-left'}`}
        style={{ backgroundColor: 'var(--color-card)' }}
      >
        <div className={`flex items-center gap-1.5 ${alignRight ? 'justify-end' : 'justify-start'}`}>
          <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
          {isCurrent ? (
            sortOrder === "asc" ? <ArrowUp size={13} className="text-primary shrink-0" /> : <ArrowDown size={13} className="text-primary shrink-0" />
          ) : (
            <ArrowUpDown size={13} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
          )}
        </div>
      </th>
    );
  };

  const handleInlineSave = async (categoryId: number, value: string) => {
    const amount = parseFloat(value) || 0;
    const currentAssigned = categoryStates[categoryId]?.assigned || 0;
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto">
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
      <div className="bg-card border border-border rounded-2xl shadow-sm py-5 px-8 text-center relative overflow-hidden flex flex-col items-center justify-center">
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
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden relative flex flex-col" style={{ maxHeight: 'calc(100vh - 340px)' }}>
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <span className="text-muted-foreground animate-pulse font-medium">Przeliczanie budżetów...</span>
          </div>
        )}
        <div className="p-0 overflow-auto flex-1 relative">
          <table className="w-full text-sm text-left whitespace-nowrap border-collapse">
            <thead className="text-muted-foreground text-xs uppercase font-medium sticky top-0 z-20" style={{ backgroundColor: 'var(--color-card)' }}>
              <tr style={{ backgroundColor: 'var(--color-card)' }}>
                {renderSortableHeader("Kategoria", "name")}
                {renderSortableHeader("Z Poprzedniego", "rollover", true)}
                {renderSortableHeader("Przypisano", "assigned", true)}
                {renderSortableHeader("Wydano", "activity", true)}
                {renderSortableHeader("Dostępne", "available", true)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedCategories.map(category => {
                const state = categoryStates[category.id] || { rollover: 0, assigned: 0, activity: 0, available: 0 };
                
                return (
                  <tr key={`${category.id}-${selectedMonth}`} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: category.color || '#ccc' }}></div>
                        <span className="font-semibold text-foreground flex items-center gap-2">
                          {category.name}
                          {state.overspent !== undefined && state.overspent < -0.01 && (
                            <div className="group/alert relative flex items-center">
                              <AlertTriangle size={14} className="text-amber-500 cursor-help" />
                              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border opacity-0 group-hover/alert:opacity-100 transition-opacity pointer-events-none z-50 text-left font-normal font-sans">
                                Kategoria miała <strong>{Math.abs(state.overspent).toFixed(2)} PLN</strong> debetu w poprzednim miesiącu. Dług został pokryty ze środków "Do Rozdysponowania", a limit dla kategorii wyzerowany na start.
                              </div>
                            </div>
                          )}
                          {state.available < -0.01 && (
                            <div className="group/alert relative flex items-center">
                              <AlertTriangle size={14} className="text-red-500 cursor-help" />
                              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border opacity-0 group-hover/alert:opacity-100 transition-opacity pointer-events-none z-50 text-left font-normal font-sans">
                                Kategoria jest przekroczona o <strong>{Math.abs(state.available).toFixed(2)} PLN</strong> w tym miesiącu! Przydziel więcej środków, aby pokryć debet.
                              </div>
                            </div>
                          )}
                        </span>
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
                            key={`${category.id}-${state.assigned}`}
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
