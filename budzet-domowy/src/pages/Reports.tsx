import { useState, useMemo } from "react";
import { ArrowUpRight, ArrowDownRight, Target, Activity, Wallet } from "lucide-react";
import { useTransactions, useAccounts, useCategories } from "../lib/queries";
import { useFinanceStore } from "../store/useFinanceStore";
import BalanceTrendChart from "../components/charts/BalanceTrendChart";
import MonthlyCashFlowChart from "../components/charts/MonthlyCashFlowChart";
import SpendingPieChart from "../components/charts/SpendingPieChart";

const formatCurrency = (amount: number, privacyMode: boolean) => {
  if (privacyMode) return '***';
  return Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
};

export default function Reports() {
  const { data: allTransactions = [] } = useTransactions();
  const { data: allAccounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { privacyMode } = useFinanceStore();

  const [dateRange, setDateRange] = useState<"3M" | "6M" | "12M" | "YTD" | "ALL">("6M");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]); // empty means all

  // 1. Zastosowanie filtrów
  const filteredData = useMemo(() => {
    let txs = [...allTransactions];
    
    // Filtr Kont
    if (selectedAccounts.length > 0) {
      txs = txs.filter(t => selectedAccounts.includes(t.account_id.toString()));
    }

    // Filtr Daty
    const now = new Date();
    let startDate: Date | null = null;
    let monthsCountForCharts = 6;

    if (dateRange === "3M") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      monthsCountForCharts = 3;
    } else if (dateRange === "6M") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      monthsCountForCharts = 6;
    } else if (dateRange === "12M") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      monthsCountForCharts = 12;
    } else if (dateRange === "YTD") {
      startDate = new Date(now.getFullYear(), 0, 1);
      monthsCountForCharts = now.getMonth() + 1;
    } else {
      // ALL
      monthsCountForCharts = 24; // Pokaż max 24 miesiące na wykresach
    }

    if (startDate) {
      const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
      txs = txs.filter(t => t.date >= startStr);
    }

    return { txs, monthsCountForCharts };
  }, [allTransactions, dateRange, selectedAccounts]);

  // 2. Obliczenia KPI
  const kpi = useMemo(() => {
    let income = 0;
    let expense = 0;
    
    filteredData.txs.forEach(t => {
      if (t.type === 'income') income += t.amount;
      if (t.type === 'expense') expense += t.amount;
    });

    const netFlow = income - expense;
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

    return { income, expense, netFlow, savingsRate };
  }, [filteredData.txs]);

  // 3. Top 5 Kategorii
  const topCategories = useMemo(() => {
    const expenses = filteredData.txs.filter(t => t.type === 'expense');
    const byCategory = expenses.reduce((acc: Record<number, number>, curr) => {
      const catId = curr.category_id || 0;
      acc[catId] = (acc[catId] || 0) + curr.amount;
      return acc;
    }, {});

    return Object.entries(byCategory)
      .map(([id, amount]) => {
        const cat = categories.find(c => c.id === parseInt(id));
        return {
          id: parseInt(id),
          name: cat?.name || 'Inne',
          color: cat?.color || '#9ca3af',
          amount,
          percent: kpi.expense > 0 ? (amount / kpi.expense) * 100 : 0
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredData.txs, categories, kpi.expense]);

  // 4. Top Transakcje
  const topTransactions = useMemo(() => {
    return filteredData.txs
      .filter(t => t.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredData.txs]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            Raporty
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Analityka finansowa i przepływy pieniężne
          </p>
        </div>
        
        {/* Panel Sterowania */}
        <div className="flex flex-row flex-wrap items-center gap-4 bg-card/60 backdrop-blur-md border border-border/50 p-3 rounded-2xl shadow-sm print:hidden w-full xl:w-auto">
          {/* Zakresy dat */}
          <div className="flex items-center flex-wrap gap-1 bg-muted/50 p-1.5 rounded-xl border border-border/50">
            {(["3M", "6M", "12M", "YTD", "ALL"] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  dateRange === range 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <div className="hidden sm:block w-px h-8 bg-border/50 mx-2"></div>

          {/* Filtry kont */}
          <div className="flex items-center flex-wrap gap-3">
            <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2 whitespace-nowrap">
              <Wallet size={16} /> Filtruj konta:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedAccounts([])}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  selectedAccounts.length === 0
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-muted-foreground"
                }`}
              >
                Wszystkie
              </button>
              {allAccounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => toggleAccount(acc.id.toString())}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border flex items-center gap-1.5 ${
                    selectedAccounts.includes(acc.id.toString())
                      ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/30"
                      : "bg-card text-muted-foreground border-border hover:border-muted-foreground"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${selectedAccounts.includes(acc.id.toString()) ? 'bg-indigo-500' : 'bg-muted-foreground/30'}`}></div>
                  {acc.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
            <ArrowUpRight size={16} className="text-emerald-500" /> Całkowity Przychód
          </p>
          <p className="text-2xl font-black text-foreground">
            {formatCurrency(kpi.income, privacyMode)}
          </p>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
            <ArrowDownRight size={16} className="text-rose-500" /> Całkowite Wydatki
          </p>
          <p className="text-2xl font-black text-foreground">
            {formatCurrency(kpi.expense, privacyMode)}
          </p>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
            <Activity size={16} className="text-indigo-500" /> Wartość Netto (Net Flow)
          </p>
          <p className={`text-2xl font-black ${kpi.netFlow >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {kpi.netFlow > 0 ? '+' : ''}{formatCurrency(kpi.netFlow, privacyMode)}
          </p>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -z-10 group-hover:scale-110 transition-transform ${kpi.savingsRate >= 15 ? 'bg-emerald-500/10' : kpi.savingsRate > 0 ? 'bg-amber-500/10' : 'bg-rose-500/10'}`} />
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
            <Target size={16} className={kpi.savingsRate >= 15 ? 'text-emerald-500' : kpi.savingsRate > 0 ? 'text-amber-500' : 'text-rose-500'} /> Savings Rate
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black text-foreground">
              {kpi.savingsRate.toFixed(1)}%
            </p>
            <span className="text-xs font-medium text-muted-foreground">z przychodów</span>
          </div>
        </div>
      </div>

      {/* Główne Wykresy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-foreground flex items-center gap-2">
            Przychody vs Wydatki (Cash-Flow)
          </h3>
          <MonthlyCashFlowChart 
            monthsCount={filteredData.monthsCountForCharts} 
            transactions={filteredData.txs} 
          />
        </div>
        
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-foreground flex items-center gap-2">
            Trend Salda (Net Worth)
          </h3>
          <BalanceTrendChart 
            monthsCount={filteredData.monthsCountForCharts}
            transactions={filteredData.txs}
            accounts={selectedAccounts.length > 0 ? allAccounts.filter(a => selectedAccounts.includes(a.id.toString())) : allAccounts}
          />
        </div>
      </div>

      {/* Dolny Rząd: Struktura i Listy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Koło */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold mb-6 text-foreground">
            Struktura Wydatków
          </h3>
          <div className="flex-1 min-h-[300px]">
            <SpendingPieChart transactions={filteredData.txs} />
          </div>
        </div>

        {/* Top Kategorie */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-foreground">
            Top Złodzieje Budżetu
          </h3>
          <div className="space-y-5">
            {topCategories.map(cat => (
              <div key={cat.id}>
                <div className="flex justify-between items-end mb-1.5">
                  <span className="font-medium text-sm flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></span>
                    {cat.name}
                  </span>
                  <span className="font-bold text-sm">
                    {formatCurrency(cat.amount, privacyMode)}
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${cat.percent}%`, backgroundColor: cat.color }}
                  ></div>
                </div>
              </div>
            ))}
            {topCategories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Brak danych w wybranym okresie.</p>
            )}
          </div>
        </div>

        {/* Top Transakcje */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-6 text-foreground">
            Największe Transakcje
          </h3>
          <div className="space-y-3">
            {topTransactions.map(tx => (
              <div key={tx.id} className="flex justify-between items-center p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex flex-col overflow-hidden pr-3">
                  <span className="font-semibold text-sm truncate">{tx.description}</span>
                  <span className="text-xs text-muted-foreground">{tx.date}</span>
                </div>
                <span className="font-bold text-sm whitespace-nowrap text-rose-500">
                  -{formatCurrency(tx.amount, privacyMode)}
                </span>
              </div>
            ))}
            {topTransactions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Brak danych w wybranym okresie.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
