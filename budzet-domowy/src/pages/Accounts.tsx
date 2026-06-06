import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useFinanceStore } from "../store/useFinanceStore";
import { useDialogStore } from "../store/useDialogStore";
import { Plus, Wallet, Trash2, Banknote, CreditCard, PiggyBank } from "lucide-react";
import { useAccounts, useAddAccount, useDeleteAccount } from "../lib/queries";

export default function Accounts() {
  const { privacyMode } = useFinanceStore();
  const { data: accounts = [], isLoading } = useAccounts();
  const addAccountMutation = useAddAccount();
  const deleteAccountMutation = useDeleteAccount();
  const { showAlert, showConfirm } = useDialogStore();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("0");
  const [type, setType] = useState("bank");

  useEffect(() => {
    if (location.search.includes("new=1")) {
      setIsModalOpen(true);
    }
  }, [location]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addAccountMutation.mutateAsync({
        name,
        type: type,
        currency: "PLN",
        balance: parseFloat(balance),
        color: "#3b82f6"
      });
      setIsModalOpen(false);
      setName("");
      setBalance("0");
    } catch (error: any) {
      showAlert("Błąd Tworzenia Konta", error.toString());
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
          onClick={() => setIsModalOpen(true)}
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
          <div key={acc.id} className={`p-6 bg-card border border-border/80 rounded-2xl shadow-sm flex flex-col gap-4 relative overflow-hidden group transition-all duration-300 hover:shadow-md ring-1 ring-transparent ${style.ring}`}>
            <div className="absolute -right-8 -top-8 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
              {style.watermark}
            </div>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${style.bg}`}>
                  {style.icon}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">{acc.name}</h3>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{acc.type === 'cash' ? 'Gotówka' : acc.type === 'bank' ? 'Konto Bankowe' : 'Oszczędności'}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(acc.id, acc.name)} className="absolute top-4 right-4 text-muted-foreground opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all p-2 rounded-xl z-20">
                <Trash2 size={18} />
              </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-[var(--color-card)] border border-border/50 p-8 rounded-2xl shadow-2xl shadow-primary/5 w-full max-w-md animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-6 tracking-tight">Dodaj nowe konto</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
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
                <label className="text-sm font-medium">Saldo początkowe (PLN)</label>
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
    </div>
  );
}
