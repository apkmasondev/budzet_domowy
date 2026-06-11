import { useState, useMemo, useRef, useEffect } from "react";
import { useFinanceStore } from "../store/useFinanceStore";
import { Plus, ArrowDownRight, ArrowUpRight, Search, Download, ArrowUpDown, Filter, Edit2, Trash2, Calendar, X } from "lucide-react";
import { useTransactions, useTransactionMonths, useAccounts, useCategories, useDeleteTransaction } from "../lib/queries";
import { useDialogStore } from "../store/useDialogStore";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSearchParams } from "react-router-dom";
import { useClickOutside } from "../hooks/useClickOutside";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

const formatMonthLabel = (monthStr: string) => {
  if (!monthStr) return "ALL";
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  const formatter = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" });
  const formatted = formatter.format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

export default function Transactions() {
  const { privacyMode, setTransactionModalOpen } = useFinanceStore();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">((searchParams.get("type") as any) || "all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const [filterMonth, setFilterMonth] = useState<string>(searchParams.get("month") || "");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: isTransactionsLoading } = useTransactions(searchTerm, filterMonth, filterType, sortBy);
  const { data: availableMonths = [] } = useTransactionMonths();
  const transactions = useMemo(() => data ? data.pages.flat() : [], [data]);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const deleteTransactionMutation = useDeleteTransaction();
  const { showConfirm } = useDialogStore();

  const handleDelete = (id: number) => {
    showConfirm(
      "Usuń operację",
      "Czy na pewno chcesz usunąć tę operację? Pieniądze wrócą na Twoje konto bankowe/portfel. Tego działania nie można cofnąć.",
      () => {
        deleteTransactionMutation.mutate(id);
      }
    );
  };

  const exportToCSV = async () => {
    try {
      // Pobieramy wszystkie pasujące z backendu (omijamy paginację)
      const allMatchedTxs = await api.getTransactions(1000000, 0, searchTerm, filterMonth, filterType, sortBy);
      
      const header = "Data,Typ,Opis,Kategoria,Konto,Kwota\n";
      const rows = allMatchedTxs.map(tx => {
        const isExpense = tx.type === "expense";
        const cat = categories.find(c => c.id === tx.category_id);
        const acc = accounts.find(a => a.id === tx.account_id);
        
        const date = tx.date;
        const typeStr = isExpense ? "Wydatek" : "Przychód";
        const desc = tx.description ? `"${tx.description.replace(/"/g, '""')}"` : "";
        const catName = cat ? `"${cat.name.replace(/"/g, '""')}"` : "";
        const accName = acc ? `"${acc.name.replace(/"/g, '""')}"` : "";
        const amountStr = isExpense ? `-${tx.amount}` : `${tx.amount}`;
        
        return `${date},${typeStr},${desc},${catName},${accName},${amountStr}`;
      }).join("\n");
      
      const csvContent = "\uFEFF" + header + rows; // utf-8 bom for excel
      
      const filePath = await save({
        filters: [{
          name: 'Plik CSV',
          extensions: ['csv']
        }],
        defaultPath: `transakcje_eksport_${new Date().toISOString().slice(0,10)}.csv`
      });

      if (filePath) {
        await writeTextFile(filePath, csvContent);
        // Plik został zapisany pomyślnie
      }
    } catch (err) {
      console.error(err);
      alert("Błąd podczas eksportu CSV.");
    }
  };

  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  
  const monthRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  
  useClickOutside(monthRef, () => setIsMonthOpen(false));
  useClickOutside(sortRef, () => setIsSortOpen(false));

  const filteredAndSorted = transactions;

  const hasActiveFilters = filterMonth !== "" || searchTerm.trim() !== "" || filterType !== "all" || sortBy !== "date_desc";

  const clearAllFilters = () => {
    setFilterMonth("");
    setSearchTerm("");
    setFilterType("all");
    setSortBy("date_desc");
  };

  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: filteredAndSorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76, // wysokość wiersza to ok. 76px (p-4 + treść)
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
    
    if (lastItem.index >= filteredAndSorted.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualItems, hasNextPage, isFetchingNextPage, fetchNextPage, filteredAndSorted.length]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center relative z-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Transakcje</h1>
        <div className="flex gap-3">
          <Button 
            onClick={exportToCSV}
            variant="secondary"
          >
            <Download size={18} /> Eksportuj CSV
          </Button>
          <Button 
            onClick={() => setTransactionModalOpen(true)}
            variant="primary"
          >
            <Plus size={18} /> Dodaj wpis
          </Button>
        </div>
      </div>

      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm relative z-10 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        
        {isTransactionsLoading && (
           <div className="p-8 text-center text-muted-foreground animate-pulse">Ładowanie transakcji...</div>
        )}

        {/* Filtry i Szukajka */}
        <div className="p-4 border-b border-border/50 bg-muted/10 flex flex-col sm:flex-row gap-4 items-center justify-between relative z-20">
          <div className="relative w-full sm:max-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Szukaj transakcji..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-1">
              <button onClick={() => setFilterType("all")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === 'all' ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>ALL</button>
              <button onClick={() => setFilterType("expense")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === 'expense' ? 'bg-red-500/10 text-red-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Wydatki</button>
              <button onClick={() => setFilterType("income")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === 'income' ? 'bg-emerald-500/10 text-emerald-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Przychody</button>
            </div>
            
            {/* Custom Month Dropdown */}
            <div className="relative z-30" ref={monthRef}>
              <button 
                onClick={() => setIsMonthOpen(!isMonthOpen)}
                className="flex items-center justify-between gap-2 bg-background border border-border hover:bg-muted/50 rounded-lg px-3 py-1.5 transition-colors min-w-[110px]"
              >
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate max-w-[85px]">
                    {filterMonth ? formatMonthLabel(filterMonth) : "ALL"}
                  </span>
                </div>
                {filterMonth ? (
                  <X size={14} className="text-muted-foreground hover:text-foreground transition-colors ml-1" onClick={(e) => { e.stopPropagation(); setFilterMonth(""); }} />
                ) : (
                  <ArrowDownRight size={14} className={`text-muted-foreground transition-transform ${isMonthOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              {isMonthOpen && (
                <div className="absolute top-full left-0 mt-1 w-full min-w-[180px] bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-xl z-50 overflow-hidden opacity-100 animate-in slide-in-from-top-2">
                  <ul className="max-h-60 overflow-y-auto py-1">
                    <li>
                      <button 
                        className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-muted ${!filterMonth ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                        onClick={() => { setFilterMonth(""); setIsMonthOpen(false); }}
                      >
                        ALL
                      </button>
                    </li>
                    {availableMonths.map(m => (
                      <li key={m}>
                        <button 
                          className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-muted ${filterMonth === m ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                          onClick={() => { setFilterMonth(m); setIsMonthOpen(false); }}
                        >
                          {formatMonthLabel(m)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            {/* Custom Sort Dropdown */}
            <div className="relative z-30" ref={sortRef}>
              <button 
                onClick={() => setIsSortOpen(!isSortOpen)}
                className="flex items-center justify-between gap-2 bg-background border border-border hover:bg-muted/50 rounded-lg px-3 py-1.5 transition-colors min-w-[160px]"
              >
                <div className="flex items-center gap-2">
                  <ArrowUpDown size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {sortBy === "date_desc" && "Najnowsze"}
                    {sortBy === "date_asc" && "Najstarsze"}
                    {sortBy === "amount_desc" && "Kwota malejąco"}
                    {sortBy === "amount_asc" && "Kwota rosnąco"}
                  </span>
                </div>
              </button>
              {isSortOpen && (
                <div className="absolute top-full right-0 mt-1 w-[160px] bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-xl z-50 overflow-hidden opacity-100 animate-in slide-in-from-top-2">
                  <ul className="py-1">
                    {[
                      { id: "date_desc", label: "Najnowsze" },
                      { id: "date_asc", label: "Najstarsze" },
                      { id: "amount_desc", label: "Kwota malejąco" },
                      { id: "amount_asc", label: "Kwota rosnąco" }
                    ].map(opt => (
                      <li key={opt.id}>
                        <button 
                          className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-muted ${sortBy === opt.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'}`}
                          onClick={() => { setSortBy(opt.id as any); setIsSortOpen(false); }}
                        >
                          {opt.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            {hasActiveFilters && (
              <button 
                onClick={clearAllFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors ml-auto sm:ml-0"
              >
                <X size={14} /> Wyczyść filtry
              </button>
            )}
          </div>
        </div>

        {filteredAndSorted.length === 0 ? (
          <EmptyState 
            icon={Filter} 
            title="Brak pasujących transakcji" 
            description="Zmień kryteria wyszukiwania lub filtry, aby znaleźć to czego szukasz."
          />
        ) : (
          <div ref={parentRef} className="flex-1 overflow-y-auto relative z-10">
            <div 
              className="divide-y divide-border relative"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const tx = filteredAndSorted[virtualRow.index];
                const isExpense = tx.type === "expense";
                const cat = categories.find(c => c.id === tx.category_id);
                const acc = accounts.find(a => a.id === tx.account_id);
                return (
                  <div 
                    key={tx.id} 
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors absolute top-0 left-0 w-full group"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpense ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {isExpense ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-base tracking-tight mb-1">
                          {tx.description ? tx.description : (cat?.name || "Transakcja")}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 bg-muted/70 px-2 py-0.5 rounded-md">
                            <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: cat?.color || '#8b5cf6' }} />
                            <span className="text-[10px] uppercase tracking-wider font-bold text-foreground">
                              {cat?.name || "Bez kategorii"}
                            </span>
                          </div>
                          <span className="text-xs font-medium px-2 py-0.5 bg-secondary/50 text-secondary-foreground rounded-md">
                            {acc?.name || "Nieznane konto"}
                          </span>
                          <span className="text-xs text-muted-foreground font-medium">{tx.date}</span>
                          {tx.tags && tx.tags.map(tag => (
                            <span 
                              key={tag} 
                              onClick={(e) => { e.stopPropagation(); setSearchTerm('#' + tag); }}
                              className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary rounded-md cursor-pointer hover:bg-primary/20 transition-colors"
                              title="Filtruj po tym tagu"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Action buttons (Edit / Delete) shown on hover */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-[76px] overflow-hidden shrink-0">
                        <button 
                          onClick={() => setTransactionModalOpen(true, tx.id)}
                          className="p-2 rounded-full bg-primary/10 text-primary hover:bg-slate-800 hover:text-slate-100 dark:hover:bg-primary dark:hover:text-white transition-all cursor-pointer shrink-0"
                          title="Edytuj operację"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(tx.id)}
                          className="p-2 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all cursor-pointer shrink-0"
                          title="Usuń operację"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className={`font-bold text-lg tracking-tight ${isExpense ? 'text-red-500' : 'text-emerald-500'} shrink-0`}>
                        {isExpense ? "-" : "+"}{privacyMode ? '***' : tx.amount.toFixed(2)} PLN
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
