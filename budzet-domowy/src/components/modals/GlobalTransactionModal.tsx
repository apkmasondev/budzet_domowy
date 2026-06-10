import { useState, useEffect } from "react";
import { useFinanceStore } from "../../store/useFinanceStore";
import { ArrowDownRight, ArrowUpRight, AlertTriangle } from "lucide-react";
import { useAccounts, useCategories, useAddTransaction, useUpdateTransaction, useTransactions } from "../../lib/queries";

export default function GlobalTransactionModal() {
  const { isTransactionModalOpen, editingTransactionId, setTransactionModalOpen } = useFinanceStore();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const addTransactionMutation = useAddTransaction();
  const updateTransactionMutation = useUpdateTransaction();
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [pendingOverdraft, setPendingOverdraft] = useState<{ amount: number, accountName: string } | null>(null);

  useEffect(() => {
    if (isTransactionModalOpen && editingTransactionId) {
      const txToEdit = transactions.find(t => t.id === editingTransactionId);
      if (txToEdit) {
        setAmount(txToEdit.amount.toString());
        setType(txToEdit.type);
        setAccountId(txToEdit.account_id.toString());
        setCategoryId(txToEdit.category_id?.toString() || "");
        setDescription(txToEdit.description || "");
        setTagsInput(txToEdit.tags ? txToEdit.tags.map(t => `#${t}`).join(" ") : "");
      }
    } else if (isTransactionModalOpen && !editingTransactionId) {
      setAmount("");
      setDescription("");
      setTagsInput("");
    }
  }, [isTransactionModalOpen, editingTransactionId, transactions]);

  // Close on Escape when not overdrafting
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTransactionModalOpen && !pendingOverdraft) {
        setTransactionModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isTransactionModalOpen, pendingOverdraft, setTransactionModalOpen]);

  if (!isTransactionModalOpen) return null;

  const executeTransaction = async (parsedAmount: number) => {
    try {
      const parsedTags = tagsInput
        .split(/[\s,]+/)
        .map(t => t.replace(/^#/, '').trim())
        .filter(t => t.length > 0);

      const payload = {
        account_id: parseInt(accountId),
        category_id: parseInt(categoryId),
        amount: parsedAmount,
        type: type,
        description: description || undefined,
        date: new Date().toISOString().split('T')[0], // We keep current date for new ones, but for edit we should probably preserve old date!
        transfer_to_id: undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined
      };

      if (editingTransactionId) {
        const txToEdit = transactions.find(t => t.id === editingTransactionId);
        if (txToEdit) payload.date = txToEdit.date; // Preserve old date
        await updateTransactionMutation.mutateAsync({ id: editingTransactionId, payload });
      } else {
        await addTransactionMutation.mutateAsync(payload);
      }
      setTransactionModalOpen(false);
      setAmount("");
      setDescription("");
      setTagsInput("");
      setPendingOverdraft(null);
    } catch (error) {
      console.error("Błąd zapisu:", error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !categoryId) return;

    const parsedAmount = parseFloat(amount);
    const selectedAccount = accounts.find(a => a.id === parseInt(accountId));
    
    if (type === "expense" && selectedAccount && selectedAccount.balance < parsedAmount) {
      setPendingOverdraft({ amount: parsedAmount, accountName: selectedAccount.name });
      return;
    }
    
    await executeTransaction(parsedAmount);
  };

  return (
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4" onClick={() => setTransactionModalOpen(false)}>
        <div className="bg-[var(--color-card)] border border-border/50 p-8 rounded-2xl shadow-2xl shadow-primary/5 w-full max-w-md animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
          <h2 className="text-2xl font-bold mb-6 tracking-tight text-foreground">{editingTransactionId ? "Edytuj operację" : "Szybka operacja"}</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-5">
            
            {/* Segmented Control */}
            <div className="flex p-1 bg-muted/40 border border-border rounded-xl">
              <button 
                type="button" 
                onClick={() => setType("expense")} 
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${type === "expense" ? "bg-card shadow-sm text-red-500 border border-border/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <ArrowDownRight size={18} />
                Wydatek
              </button>
              <button 
                type="button" 
                onClick={() => setType("income")} 
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${type === "income" ? "bg-card shadow-sm text-emerald-500 border border-border/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <ArrowUpRight size={18} />
                Przychód
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Kwota (PLN)</label>
              <input autoFocus required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="0.00" />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Konto</label>
              <select required value={accountId} onChange={e => setAccountId(e.target.value)} className="bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="" className="bg-background text-foreground">Wybierz konto...</option>
                {accounts.map(a => <option key={a.id} value={a.id} className="bg-background text-foreground">{a.name} ({a.balance.toFixed(2)} PLN)</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Kategoria</label>
              <select required value={categoryId} onChange={e => setCategoryId(e.target.value)} className="bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="" className="bg-background text-foreground">Wybierz kategorię...</option>
                {categories.filter(c => c.type === type || c.type === "both").map(c => <option key={c.id} value={c.id} className="bg-background text-foreground">{c.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Opis (opcjonalny)</label>
              <input value={description} onChange={e => setDescription(e.target.value)} className="bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="np. Biedronka, Wypłata" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Tagi (opcjonalnie)</label>
              <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} className="bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="np. wakacje, dom (oddzielone spacją lub przecinkiem)" />
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button type="button" onClick={() => setTransactionModalOpen(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Anuluj</button>
              <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">{editingTransactionId ? "Zaktualizuj" : "Zapisz"}</button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal Ostrzegawczy Ujemnego Salda */}
      {pendingOverdraft && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-4" onClick={() => setPendingOverdraft(null)}>
          <div className="bg-[var(--color-card)] border border-red-500/30 p-8 rounded-2xl shadow-2xl shadow-red-500/10 w-full max-w-sm animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-5">
              <AlertTriangle size={24} />
            </div>
            <h2 className="text-xl font-bold mb-2 tracking-tight text-foreground">Uwaga: Ujemne saldo</h2>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              Ten wydatek spowoduje, że na koncie <span className="font-semibold text-foreground">"{pendingOverdraft.accountName}"</span> zabraknie środków (saldo ujemne).
              <br/><br/>
              Czy na pewno chcesz kontynuować i wejść na debet?
            </p>
            <div className="flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setPendingOverdraft(null)} 
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"
              >
                Anuluj
              </button>
              <button 
                type="button"
                onClick={() => executeTransaction(pendingOverdraft.amount)} 
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 shadow-md shadow-red-500/20 transition-all"
              >
                Tak, zapisz wydatek
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
