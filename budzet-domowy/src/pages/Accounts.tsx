import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useFinanceStore } from "../store/useFinanceStore";
import { useDialogStore } from "../store/useDialogStore";
import { Plus, Wallet, Trash2, Banknote, CreditCard, PiggyBank, Pencil } from "lucide-react";
import { useAccounts, useAddAccount, useDeleteAccount, useUpdateAccount, useAllTransactions, useCategories } from "../lib/queries";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";

export default function Accounts() {
  const { privacyMode } = useFinanceStore();
  const { data: accounts = [], isLoading } = useAccounts();
  const { data: allTransactions = [] } = useAllTransactions();
  const { data: categories = [] } = useCategories();
  const addAccountMutation = useAddAccount();
  const updateAccountMutation = useUpdateAccount();
  const deleteAccountMutation = useDeleteAccount();
  const { showAlert, showConfirm } = useDialogStore();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingColor, setEditingColor] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("0");
  const [type, setType] = useState("bank");
  const [quickViewAccount, setQuickViewAccount] = useState<any>(null);

  const accountModalRef = useFocusTrap(isModalOpen);
  const quickViewModalRef = useFocusTrap(!!quickViewAccount);

  useEffect(() => {
    if (location.search.includes("new=1")) {
      setIsModalOpen(true);
    }
  }, [location]);

  const openCreateModal = () => {
    setEditingId(null);
    setName("");
    setBalance("0");
    setType("bank");
    setEditingColor(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (acc: any) => {
    setEditingId(acc.id);
    setName(acc.name);
    setBalance(acc.balance.toString());
    setType(acc.type);
    setEditingColor(acc.color);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const originalAccount = accounts.find(a => a.id === editingId);
      if (originalAccount && originalAccount.balance !== parseFloat(balance)) {
        showConfirm(
          "Zmiana salda konta", 
          "Zmieniasz stan konta ręcznie. Zalecane jest korzystanie z transakcji w celu zachowania ciągłości historii. Czy na pewno chcesz nadpisać saldo?", 
          () => executeSubmit()
        );
      } else {
        executeSubmit();
      }
    } else {
      executeSubmit();
    }
  };

  const executeSubmit = async () => {
    try {
      if (editingId) {
        await updateAccountMutation.mutateAsync({
          id: editingId,
          payload: {
            name,
            type: type,
            currency: "PLN",
            balance: parseFloat(balance),
            color: editingColor || "#3b82f6"
          }
        });
      } else {
        await addAccountMutation.mutateAsync({
          name,
          type: type,
          currency: "PLN",
          balance: parseFloat(balance),
          color: "#3b82f6"
        });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setName("");
      setBalance("0");
    } catch (error: any) {
      showAlert(editingId ? "Błąd Edycji Konta" : "Błąd Tworzenia Konta", error.toString());
    }
  };

  const handleDelete = (id: number, name: string) => {
    showConfirm(
      "Usuwanie konta",
      `Czy na pewno chcesz usunąć konto "${name}"? Stracisz przypisane do niego transakcje.`,
      () => deleteAccountMutation.mutate(id)
    );
  };

  const getAccountStyle = (type: string) => {
    switch(type) {
      case 'cash': return { 
        icon: <Banknote size={24} className="text-emerald-500" />, 
        watermark: <Banknote size={140} strokeWidth={1} className="text-emerald-500" />,
        bg: "bg-emerald-500/10 text-emerald-500", 
        ring: "hover:ring-emerald-500/30" 
      };
      case 'bank': return { 
        icon: <CreditCard size={24} className="text-blue-500" />, 
        watermark: <CreditCard size={140} strokeWidth={1} className="text-blue-500" />,
        bg: "bg-blue-500/10 text-blue-500", 
        ring: "hover:ring-blue-500/30" 
      };
      case 'savings': return { 
        icon: <PiggyBank size={24} className="text-purple-500" />, 
        watermark: <PiggyBank size={140} strokeWidth={1} className="text-purple-500" />,
        bg: "bg-purple-500/10 text-purple-500", 
        ring: "hover:ring-purple-500/30" 
      };
      default: return { 
        icon: <Wallet size={24} className="text-primary" />, 
        watermark: <Wallet size={140} strokeWidth={1} className="text-primary" />,
        bg: "bg-primary/10 text-primary", 
        ring: "hover:ring-primary/30" 
      };
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center relative z-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Konta i Portfele</h1>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Plus size={18} /> Nowe konto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        {isLoading && <p className="text-muted-foreground animate-pulse col-span-full">Ładowanie kont...</p>}
        {accounts.map(acc => {
          const style = getAccountStyle(acc.type);
          return (
          <div key={acc.id} onClick={() => setQuickViewAccount(acc)} className={`p-6 bg-card border border-border/80 rounded-2xl shadow-sm flex flex-col gap-4 relative overflow-hidden group transition-all duration-300 hover:shadow-md ring-1 ring-transparent cursor-pointer ${style.ring}`}>
            <div className="absolute -right-8 -top-8 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
              {style.watermark}
            </div>
            <div className="absolute top-4 right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all z-20 print:hidden">
              <button 
                onClick={(e) => { e.stopPropagation(); openEditModal(acc); }} 
                className="text-muted-foreground hover:text-primary hover:bg-primary/10 hover:scale-110 transition-all p-2 rounded-xl cursor-pointer"
                title="Edytuj konto"
              >
                <Pencil size={18} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDelete(acc.id, acc.name); }} 
                className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 hover:scale-110 transition-all p-2 rounded-xl cursor-pointer"
                title="Usuń konto"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${style.bg}`}>
                  {style.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground pr-16">{acc.name}</h3>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{acc.type === 'cash' ? 'Gotówka' : acc.type === 'bank' ? 'Konto Bankowe' : 'Oszczędności'}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 relative z-10">
              <p className="text-4xl font-black text-foreground tracking-tight">
                {privacyMode ? '***' : acc.balance.toFixed(2)} <span className="text-xl font-bold text-muted-foreground ml-1">{acc.currency}</span>
              </p>
            </div>
          </div>
        )})}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
          <div ref={accountModalRef} className="bg-[var(--color-card)] border border-border/50 p-8 rounded-2xl shadow-2xl shadow-primary/5 w-full max-w-md animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-6 tracking-tight">{editingId ? 'Edytuj konto' : 'Dodaj nowe konto'}</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Nazwa konta</label>
                <input required value={name} onChange={e => setName(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="np. PKO Bank, Portfel" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Typ konta</label>
                <select value={type} onChange={e => setType(e.target.value)} className="bg-background text-foreground border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="bank">Konto Bankowe</option>
                  <option value="cash">Gotówka</option>
                  <option value="savings">Konto oszczędnościowe</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">{editingId ? 'Saldo konta (PLN)' : 'Saldo początkowe (PLN)'}</label>
                <input required type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Anuluj</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Zapisz</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {quickViewAccount && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setQuickViewAccount(null)}>
          <div ref={quickViewModalRef} className="bg-[var(--color-card)] border border-border/50 p-6 rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold tracking-tight">Ostatnie transakcje: {quickViewAccount.name}</h2>
              <button onClick={() => setQuickViewAccount(null)} className="p-2 hover:bg-muted rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2">
              {allTransactions.filter(t => t.account_id === quickViewAccount.id).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Brak transakcji na tym koncie.</p>
              ) : (
                allTransactions
                  .filter(t => t.account_id === quickViewAccount.id)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 10)
                  .map(tx => {
                    const isExpense = tx.type === "expense";
                    const cat = categories.find(c => c.id === tx.category_id);
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-xl transition-colors border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpense ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {isExpense ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm mb-0.5">{tx.description || cat?.name || "Transakcja"}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{tx.date}</span>
                            </div>
                          </div>
                        </div>
                        <div className={`font-bold text-sm ${isExpense ? 'text-red-500' : 'text-emerald-500'}`}>
                          {isExpense ? "-" : "+"}{privacyMode ? '***' : tx.amount.toFixed(2)} PLN
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-border flex justify-end">
              <button onClick={() => setQuickViewAccount(null)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80">Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
