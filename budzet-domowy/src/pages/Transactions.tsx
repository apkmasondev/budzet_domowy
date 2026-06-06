import { useState, useMemo, useRef } from "react";
import { useFinanceStore } from "../store/useFinanceStore";
import { Plus, ArrowDownRight, ArrowUpRight, Search, Download, ArrowUpDown, Filter } from "lucide-react";
import { useTransactions, useAccounts, useCategories } from "../lib/queries";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useVirtualizer } from "@tanstack/react-virtual";

export default function Transactions() {
  const { privacyMode, setTransactionModalOpen } = useFinanceStore();
  const { data: transactions = [], isLoading: isTransactionsLoading } = useTransactions();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();

  const exportToCSV = async () => {
    try {
      const header = "Data,Typ,Opis,Kategoria,Konto,Kwota\n";
      const rows = transactions.map(tx => {
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

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");

  const filteredAndSorted = useMemo(() => {
    let result = [...transactions];

    // Typ
    if (filterType !== "all") {
      result = result.filter(tx => tx.type === filterType);
    }

    // Wyszukiwanie
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase();
      result = result.filter(tx => {
        const cat = categories.find(c => c.id === tx.category_id);
        const desc = tx.description ? tx.description.toLowerCase() : "";
        const catName = cat ? cat.name.toLowerCase() : "";
        const amountStr = tx.amount.toString();
        const tagsStr = tx.tags ? tx.tags.join(" ").toLowerCase() : "";
        
        // Można wpisać "#wakacje" albo po prostu "wakacje"
        const cleanQ = q.startsWith('#') ? q.slice(1) : q;
        
        return desc.includes(q) || catName.includes(q) || amountStr.includes(q) || tagsStr.includes(cleanQ);
      });
    }

    // Sortowanie
    result.sort((a, b) => {
      if (sortBy === "date_desc") {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (diff !== 0) return diff;
        return b.id - a.id; // jeśli ta sama data, wyższe ID (nowsze) na górze
      }
      if (sortBy === "date_asc") {
        const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (diff !== 0) return diff;
        return a.id - b.id; // jeśli ta sama data, niższe ID (starsze) na górze
      }
      if (sortBy === "amount_desc") {
        const diff = b.amount - a.amount;
        if (diff !== 0) return diff;
        return b.id - a.id;
      }
      if (sortBy === "amount_asc") {
        const diff = a.amount - b.amount;
        if (diff !== 0) return diff;
        return b.id - a.id;
      }
      return 0;
    });

    return result;
  }, [transactions, searchTerm, filterType, sortBy, categories]);

  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: filteredAndSorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76, // wysokość wiersza to ok. 76px (p-4 + treść)
    overscan: 5,
  });

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center relative z-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Transakcje</h1>
        <div className="flex gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Download size={18} /> Eksportuj CSV
          </button>
          <button 
            onClick={() => setTransactionModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus size={18} /> Dodaj wpis
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm relative z-10 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        
        {isTransactionsLoading && (
           <div className="p-8 text-center text-muted-foreground animate-pulse">Ładowanie transakcji...</div>
        )}

        {/* Filtry i Szukajka */}
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
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
              <button onClick={() => setFilterType("all")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === 'all' ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Wszystkie</button>
              <button onClick={() => setFilterType("expense")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === 'expense' ? 'bg-red-500/10 text-red-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Wydatki</button>
              <button onClick={() => setFilterType("income")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterType === 'income' ? 'bg-emerald-500/10 text-emerald-500 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Przychody</button>
            </div>
            
            <div className="relative flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary transition-shadow">
              <ArrowUpDown size={16} className="text-muted-foreground shrink-0" />
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-sm font-medium focus:outline-none appearance-none cursor-pointer text-foreground pr-4"
              >
                <option value="date_desc" className="bg-background text-foreground">Najnowsze</option>
                <option value="date_asc" className="bg-background text-foreground">Najstarsze</option>
                <option value="amount_desc" className="bg-background text-foreground">Kwota malejąco</option>
                <option value="amount_asc" className="bg-background text-foreground">Kwota rosnąco</option>
              </select>
            </div>
          </div>
        </div>

        {filteredAndSorted.length === 0 ? (
           <div className="p-12 text-center flex flex-col items-center justify-center flex-1">
             <Filter size={48} className="text-muted-foreground opacity-30 mb-4" />
             <p className="text-lg font-medium text-muted-foreground">Brak pasujących transakcji.</p>
           </div>
        ) : (
          <div ref={parentRef} className="flex-1 overflow-y-auto relative">
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
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors absolute top-0 left-0 w-full"
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
                            <span key={tag} className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary rounded-md">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className={`font-bold text-lg tracking-tight ${isExpense ? 'text-red-500' : 'text-emerald-500'}`}>
                      {isExpense ? "-" : "+"}{privacyMode ? '***' : tx.amount.toFixed(2)} PLN
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
