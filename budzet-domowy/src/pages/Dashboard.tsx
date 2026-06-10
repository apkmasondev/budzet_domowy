import { Wallet, PieChart as PieChartIcon, TrendingDown, TrendingUp, History, Repeat, Printer, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useFinanceStore } from "../store/useFinanceStore";
import SpendingPieChart from "../components/charts/SpendingPieChart";
import MonthlyCashFlowChart from "../components/charts/MonthlyCashFlowChart";
import { useAccounts, useCategories, useAllTransactions, useBudgets, useRecurrings } from "../lib/queries";
import { useReadyToAssign } from "../hooks/useReadyToAssign";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    autoProcessedCount, 
    dismissAutoProcessNotification,
    privacyMode
  } = useFinanceStore();

  const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

  const { data: accounts = [], isLoading: isAccountsLoading } = useAccounts();
  const { data: transactions = [], isLoading: isTransactionsLoading } = useAllTransactions();
  const { data: budgets = [] } = useBudgets(currentMonth);
  const { data: categories = [] } = useCategories();
  const { data: recurrings = [] } = useRecurrings();
  const readyToAssign = useReadyToAssign();

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  
  const expensesThisMonth = transactions
    .filter(tx => tx.type === "expense" && tx.date.startsWith(currentMonth))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const incomesThisMonth = transactions
    .filter(tx => tx.type === "income" && tx.date.startsWith(currentMonth))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const activeSubscriptions = recurrings ? recurrings.filter(r => r.active).length : 0;
  const paidSubscriptionsCount = recurrings
    ? recurrings.filter(r => r.active && r.next_date.substring(0, 7) > currentMonth).length
    : 0;

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const overbudgetAlerts = budgets.filter(b => {
    const spent = transactions
      .filter(t => t.category_id === b.category_id && t.date.startsWith(currentMonth))
      .reduce((sum, t) => sum + t.amount, 0);
    return b.amount > 0 && spent > b.amount;
  }).map(b => {
    const cat = categories.find(c => c.id === b.category_id);
    return cat ? cat.name : "Nieznana";
  });

  const handlePrint = () => {
    window.print();
  };

  const getFontSize = (amount: number, isMain: boolean = false) => {
    const len = amount.toFixed(2).length;
    if (isMain) {
      if (len > 10) return "text-2xl sm:text-2xl lg:text-xl xl:text-2xl";
      if (len > 8) return "text-3xl sm:text-3xl lg:text-2xl xl:text-3xl";
      return "text-4xl sm:text-4xl lg:text-3xl xl:text-4xl";
    }
    if (len > 10) return "text-xl";
    if (len > 8) return "text-2xl";
    return "text-3xl";
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10 w-full max-w-7xl mx-auto">
      
      {/* Nagłówek z Przyciskami - Ukrywane przy druku */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Przegląd Finansów</h1>
          <p className="text-muted-foreground mt-1 text-sm">Podsumowanie bieżącego miesiąca i statystyki.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handlePrint}
            className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors shadow-sm flex items-center gap-2"
          >
            <Printer size={16} /> Eksportuj PDF
          </button>
        </div>
      </div>

      {(isAccountsLoading || isTransactionsLoading) && (
        <div className="flex justify-center p-8"><p className="text-muted-foreground animate-pulse">Ładowanie kokpitu...</p></div>
      )}

      {autoProcessedCount > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 print:hidden">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500" size={24} />
            <div>
              <p className="font-bold">Automatyczne księgowanie</p>
              <p className="text-sm opacity-90">System Rusta pomyślnie przetworzył i zaksięgował {autoProcessedCount} zaległe zlecenia stałe podczas tego uruchomienia.</p>
            </div>
          </div>
          <button onClick={dismissAutoProcessNotification} className="p-2 hover:bg-emerald-500/20 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
      )}

      {/* Tytuł widoczny tylko na wydruku */}
      <div className="hidden print:block mb-4 mt-8">
        <h1 className="text-4xl font-bold text-black border-b-2 border-black/20 pb-4">Raport Finansowy</h1>
        <p className="text-gray-600 mt-2 font-medium">Miesiąc rozliczeniowy: {currentMonth}</p>
      </div>

      {/* Alerty Budżetowe */}
      {overbudgetAlerts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-600 p-4 rounded-xl flex items-start gap-3 print:hidden shadow-sm">
          <AlertCircle className="mt-0.5 shrink-0" size={20} />
          <div>
            <h3 className="font-semibold text-sm">Przekroczone budżety w tym miesiącu!</h3>
            <p className="text-xs opacity-90 mt-1">Uważaj, wyczerpałeś limit dla: <span className="font-semibold">{overbudgetAlerts.join(", ")}</span>.</p>
          </div>
        </div>
      )}

      {/* Karty KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8 print:block print:space-y-6">
        
        {/* Ready To Assign Card */}
        <div onClick={() => navigate('/budgets')} className="bg-gradient-to-br from-emerald-500/10 to-indigo-500/10 dark:from-emerald-500/20 dark:to-indigo-500/20 backdrop-blur-xl border border-emerald-500/30 p-6 rounded-2xl shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 print:bg-none print:shadow-none print:border-border print:text-black print:break-inside-avoid cursor-pointer">
          <div className="absolute -right-6 -bottom-6 text-emerald-500/10 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 print:hidden">
            <Wallet size={120} strokeWidth={1} />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-foreground font-bold print:text-black">Do Rozdysponowania</h3>
          </div>
          <div className="relative z-10 mt-1 flex items-baseline gap-1.5 flex-wrap">
            <span className={`${getFontSize(readyToAssign, true)} font-black leading-tight print:text-black ${readyToAssign > 0.01 ? 'text-emerald-600 dark:text-emerald-400' : readyToAssign < -0.01 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
              {privacyMode ? '***' : new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(readyToAssign)}
            </span>
            <span className={`text-lg sm:text-xl opacity-80 print:opacity-100 print:text-black font-bold shrink-0 ${readyToAssign > 0.01 ? 'text-emerald-600 dark:text-emerald-400' : readyToAssign < -0.01 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>PLN</span>
          </div>
        </div>

        {/* Total Balance Card */}
        <div onClick={() => navigate('/accounts')} className="bg-gradient-to-br from-blue-500/5 to-transparent dark:from-blue-500/10 dark:to-card backdrop-blur-md border border-blue-500/10 dark:border-blue-500/20 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all duration-300 group relative overflow-hidden print:bg-none print:border-border print:break-inside-avoid cursor-pointer">
          <div className="absolute -right-6 -bottom-6 text-blue-500/10 dark:text-blue-400/10 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 print:hidden">
            <Wallet size={120} strokeWidth={1} />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-muted-foreground font-medium group-hover:text-foreground transition-colors print:text-black">Całkowite saldo</h3>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500/20 transition-colors print:hidden">
               <Wallet size={20} />
            </div>
          </div>
          <div className="relative z-10 mt-1 flex items-baseline gap-1.5 flex-wrap">
            <span className={`${getFontSize(totalBalance)} font-bold text-foreground leading-tight print:text-black`}>
              {privacyMode ? '***' : new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalBalance)}
            </span>
            <span className="text-lg font-bold text-muted-foreground print:opacity-100 print:text-black shrink-0">PLN</span>
          </div>
        </div>

        {/* Expenses Card */}
        <div onClick={() => navigate('/transactions?type=expense')} className="bg-gradient-to-br from-red-500/5 to-transparent dark:from-red-500/10 dark:to-card backdrop-blur-md border border-red-500/10 dark:border-red-500/20 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-red-500/30 transition-all duration-300 group relative overflow-hidden print:bg-none print:border-border print:break-inside-avoid cursor-pointer">
          <div className="absolute -right-8 -bottom-8 text-red-600/10 dark:text-red-400/10 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 print:hidden">
            <TrendingDown size={140} strokeWidth={1} />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-muted-foreground font-medium group-hover:text-foreground transition-colors print:text-black">Wydatki w tym mies.</h3>
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500/20 transition-colors print:hidden">
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="relative z-10 mt-1 flex items-baseline gap-1.5 flex-wrap">
            <span className={`${getFontSize(expensesThisMonth)} font-bold text-foreground leading-tight print:text-black`}>
              {privacyMode ? '***' : new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(expensesThisMonth)}
            </span>
            <span className="text-lg font-bold text-muted-foreground print:opacity-100 print:text-black shrink-0">PLN</span>
          </div>
        </div>

        {/* Incomes Card */}
        <div onClick={() => navigate('/transactions?type=income')} className="bg-gradient-to-br from-emerald-500/5 to-transparent dark:from-emerald-500/10 dark:to-card backdrop-blur-md border border-emerald-500/10 dark:border-emerald-500/20 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 group relative overflow-hidden print:bg-none print:border-border print:break-inside-avoid cursor-pointer">
          <div className="absolute -right-8 -bottom-8 text-emerald-600/10 dark:text-emerald-400/10 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 print:hidden">
            <TrendingUp size={140} strokeWidth={1} />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-muted-foreground font-medium group-hover:text-foreground transition-colors print:text-black">Przychody w tym mies.</h3>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500/20 transition-colors print:hidden">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="relative z-10 mt-1 flex items-baseline gap-1.5 flex-wrap">
            <span className={`${getFontSize(incomesThisMonth)} font-bold text-foreground leading-tight print:text-black`}>
              {privacyMode ? '***' : new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(incomesThisMonth)}
            </span>
            <span className="text-lg font-bold text-muted-foreground print:opacity-100 print:text-black shrink-0">PLN</span>
          </div>
        </div>

        {/* Subscriptions Card */}
        <div onClick={() => navigate('/subscriptions')} className="bg-gradient-to-br from-indigo-500/5 to-transparent dark:from-indigo-500/10 dark:to-card backdrop-blur-md border border-indigo-500/10 dark:border-indigo-500/20 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all duration-300 group relative overflow-hidden print:bg-none print:border-border print:break-inside-avoid cursor-pointer">
          <div className="absolute -right-6 -bottom-6 text-indigo-500/10 dark:text-indigo-400/10 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 print:hidden">
            <Repeat size={120} strokeWidth={1} />
          </div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-muted-foreground font-medium group-hover:text-foreground transition-colors print:text-black">Aktywne Subskrypcje</h3>
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500/20 transition-colors print:hidden">
              <Repeat size={20} />
            </div>
          </div>
          <div className="relative z-10 mt-1 flex flex-col">
            <p className="text-3xl font-bold text-foreground leading-tight print:text-black">{activeSubscriptions}</p>
            {activeSubscriptions > 0 && (
              <span className="text-xs text-muted-foreground mt-2 font-medium">
                Zaksięgowane: <span className="font-semibold text-emerald-500">{paidSubscriptionsCount}</span> z {activeSubscriptions}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sekcja Wykresów */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 print:block print:space-y-6">
        {/* Trend Wykres */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
          <h3 className="text-lg font-bold mb-6 text-foreground flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-500" />
            Cash-Flow (Ostatnie 6 miesięcy)
          </h3>
          <div className="flex-1 min-h-0">
            <MonthlyCashFlowChart transactions={transactions} />
          </div>
        </div>

        {/* Struktura wydatków */}
        <div className="bg-card/60 backdrop-blur-md border border-border/50 p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center min-h-[350px] print:break-inside-avoid print:mt-6">
          <h3 className="w-full text-lg font-semibold mb-6 flex items-center gap-2"><PieChartIcon size={18} className="text-primary"/> Struktura wydatków</h3>
          <div className="w-full flex-1 min-h-0">
            <SpendingPieChart month={currentMonth} transactions={transactions} />
          </div>
        </div>
      </div>

      {/* Ostatnie transakcje */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden print:break-inside-avoid print:border-border print:mt-8 group">
        <div className="p-6 border-b border-border bg-gradient-to-r from-muted/50 to-muted/10 relative overflow-hidden print:bg-none">
          <div className="absolute -right-4 -top-8 text-primary opacity-10 print:hidden group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-700">
            <History size={120} strokeWidth={1} />
          </div>
          <h3 className="font-bold text-lg relative z-10">Ostatnie transakcje</h3>
        </div>
        <div className="p-0 relative z-10 bg-card">
          {recentTransactions.length > 0 ? (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <tbody className="divide-y divide-border">
                {recentTransactions.map(tx => {
                  const cat = categories.find(c => c.id === tx.category_id);
                  const isIncome = tx.type === "income";
                  const isTransfer = tx.type === "transfer";
                  
                  return (
                    <tr 
                      key={tx.id} 
                      onClick={() => {
                        const searchVal = tx.description ? tx.description : (cat?.name || "");
                        navigate(`/transactions?search=${encodeURIComponent(searchVal)}`);
                      }}
                      className="hover:bg-muted/50 transition-colors cursor-pointer group/row"
                      title="Kliknij, aby przefiltrować historię po tym wpisie"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow-inner print:border print:border-gray-200" style={{ backgroundColor: cat?.color ? `${cat.color}20` : '#ccc', color: cat?.color || '#555' }}>
                            {cat?.name.substring(0, 2).toUpperCase() || '..'}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-base">{tx.description || cat?.name || 'Transakcja'}</span>
                            <span className="text-xs text-muted-foreground">{tx.date}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold text-base ${isIncome ? 'text-emerald-500 print:text-black' : isTransfer ? 'text-blue-500 print:text-black' : 'text-foreground'}`}>
                          {isIncome ? '+' : isTransfer ? '' : '-'}{privacyMode ? '***' : tx.amount.toFixed(2)} PLN
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nie masz jeszcze żadnych transakcji.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
