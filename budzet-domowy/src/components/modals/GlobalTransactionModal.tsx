import { useState, useEffect } from "react";
import { useFinanceStore } from "../../store/useFinanceStore";
import { useDialogStore } from "../../store/useDialogStore";
import { ArrowDownRight, ArrowUpRight, AlertTriangle, ArrowRightLeft, Plus } from "lucide-react";
import { useAccounts, useCategories, useAddTransaction, useUpdateTransaction, useTags, useTransaction, useCreateCategory } from "../../lib/queries";

import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

export default function GlobalTransactionModal() {
  const { isTransactionModalOpen, editingTransactionId, setTransactionModalOpen } = useFinanceStore();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: txToEdit } = useTransaction(editingTransactionId);
  const { data: allTagsObj = [] } = useTags();
  const allTags = allTagsObj.map(t => t.name);
  const addTransactionMutation = useAddTransaction();
  const updateTransactionMutation = useUpdateTransaction();
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [pendingOverdraft, setPendingOverdraft] = useState<{ amount: number, accountName: string } | null>(null);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const createCategoryMutation = useCreateCategory();
  const { showAlert } = useDialogStore();
  const isSaving = addTransactionMutation.isPending || updateTransactionMutation.isPending;

  useEffect(() => {
    if (isTransactionModalOpen && editingTransactionId && txToEdit) {
      setAmount(txToEdit.amount.toString());
      setType(txToEdit.type);
      setAccountId(txToEdit.account_id.toString());
      setCategoryId(txToEdit.category_id?.toString() || "");
      setTransferToId(txToEdit.transfer_to_id?.toString() || "");
      setDescription(txToEdit.description || "");
      setTagsInput(txToEdit.tags ? txToEdit.tags.map(t => `#${t}`).join(" ") : "");
    } else if (isTransactionModalOpen && !editingTransactionId) {
      setAmount("");
      setDescription("");
      setTagsInput("");
      setCategoryId("");
      setTransferToId("");
      setShowNewCat(false);
      setNewCatName("");
    }
  }, [isTransactionModalOpen, editingTransactionId, txToEdit]);

  // Obsługa Escape żyje w komponencie <Modal> i jest świadoma stosu okien,
  // więc lokalny nasłuch (który zamykał formularz spod ostrzeżenia o debecie) zniknął.

  if (!isTransactionModalOpen) return null;

  const executeTransaction = async (parsedAmount: number) => {
    try {
      const parsedTags = tagsInput
        .split(/[\s,]+/)
        .map(t => t.replace(/^#/, '').trim())
        .filter(t => t.length > 0);

      const payload = {
        account_id: parseInt(accountId),
        category_id: type === "transfer" || !categoryId ? undefined : parseInt(categoryId),
        amount: parsedAmount,
        type: type,
        description: description || undefined,
        date: new Date().toISOString().split('T')[0], // We keep current date for new ones, but for edit we should probably preserve old date!
        transfer_to_id: type === "transfer" && transferToId ? parseInt(transferToId) : undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined
      };

      if (editingTransactionId) {
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
    } catch (error: any) {
      // Backend odrzuca m.in. kwotę <= 0 i przelew na to samo konto. Wcześniej błąd
      // lądował wyłącznie w konsoli — formularz po prostu "nie reagował".
      setPendingOverdraft(null);
      showAlert("Nie udało się zapisać operacji", String(error));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;
    if (type !== "transfer" && !categoryId && !editingTransactionId) return;

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showAlert("Nieprawidłowa kwota", "Kwota operacji musi być liczbą większą od zera.");
      return;
    }

    if (type === "transfer") {
      if (!transferToId) {
        showAlert("Brak konta docelowego", "Wskaż konto, na które ma trafić przelew.");
        return;
      }
      if (transferToId === accountId) {
        showAlert("Nieprawidłowy przelew", "Konto źródłowe i docelowe muszą być różne.");
        return;
      }
    }

    const selectedAccount = accounts.find(a => a.id === parseInt(accountId));

    if (type === "expense" && selectedAccount && selectedAccount.balance < parsedAmount) {
      setPendingOverdraft({ amount: parsedAmount, accountName: selectedAccount.name });
      return;
    }

    await executeTransaction(parsedAmount);
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTagsInput(val);
    
    const words = val.split(/[\s,]+/);
    const lastWord = words[words.length - 1];
    
    if (lastWord.startsWith('#') && lastWord.length > 0) {
      setShowTagSuggestions(true);
    } else {
      setShowTagSuggestions(false);
    }
  };

  const addTagSuggestion = (tag: string) => {
    const words = tagsInput.split(/[\s,]+/);
    words.pop();
    words.push(`#${tag}`);
    setTagsInput(words.join(" ") + " ");
    setShowTagSuggestions(false);
  };

  const currentTagSearch = tagsInput.split(/[\s,]+/).pop()?.replace('#', '').toLowerCase() || '';
  const filteredTags = allTags.filter(t => t.toLowerCase().includes(currentTagSearch) && t !== currentTagSearch);

  return (
    <>
      <Modal 
        isOpen={isTransactionModalOpen} 
        onClose={() => setTransactionModalOpen(false)} 
        title={editingTransactionId ? "Edytuj operację" : "Szybka operacja"}
        maxWidth="md"
      >
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
              <button 
                type="button" 
                onClick={() => setType("transfer")} 
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${type === "transfer" ? "bg-card shadow-sm text-blue-500 border border-border/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <ArrowRightLeft size={18} />
                Przelew
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

            {type === "transfer" ? (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Na konto</label>
                <select required value={transferToId} onChange={e => setTransferToId(e.target.value)} className="bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="" className="bg-background text-foreground">Wybierz konto docelowe...</option>
                  {accounts.filter(a => a.id.toString() !== accountId).map(a => <option key={a.id} value={a.id} className="bg-background text-foreground">{a.name} ({a.balance.toFixed(2)} PLN)</option>)}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-2 relative">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Kategoria</label>
                  {!showNewCat && (
                    <button type="button" onClick={() => setShowNewCat(true)} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 transition-all">
                      <Plus size={12} /> Nowa kategoria
                    </button>
                  )}
                </div>
                
                {showNewCat ? (
                  <div className="flex items-center gap-2 animate-in fade-in">
                    <input 
                      autoFocus
                      value={newCatName} 
                      onChange={e => setNewCatName(e.target.value)} 
                      placeholder="Nazwa..." 
                      className="flex-1 bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button 
                      type="button" 
                      onClick={async () => {
                        if (!newCatName.trim()) return;
                        try {
                          // Świeżo utworzona kategoria od razu staje się wybraną —
                          // wcześniej wracała pusta lista i trzeba było szukać jej ręcznie.
                          const newId = await createCategoryMutation.mutateAsync({ name: newCatName.trim(), type: type, color: "#8b5cf6" });
                          setCategoryId(String(newId));
                          setNewCatName("");
                          setShowNewCat(false);
                        } catch (error: any) {
                          showAlert("Nie udało się dodać kategorii", String(error));
                        }
                      }}
                      className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                    >
                      Dodaj
                    </button>
                    <button type="button" onClick={() => setShowNewCat(false)} className="px-3 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg border border-transparent">Anuluj</button>
                  </div>
                ) : (
                  <select 
                    required={!editingTransactionId} 
                    value={categoryId} 
                    onChange={e => setCategoryId(e.target.value)} 
                    className="bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="" className="bg-background text-foreground">Wybierz kategorię...</option>
                    {categories.filter(c => c.type === type || c.type === "both").map(c => <option key={c.id} value={c.id} className="bg-background text-foreground">{c.name}</option>)}
                  </select>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">Opis (opcjonalny)</label>
              <input value={description} onChange={e => setDescription(e.target.value)} className="bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="np. Biedronka, Wypłata" />
            </div>

            <div className="flex flex-col gap-2 relative">
              <label className="text-sm font-medium text-foreground">Tagi (opcjonalnie)</label>
              <input 
                value={tagsInput} 
                onChange={handleTagsChange} 
                onFocus={() => {
                  const words = tagsInput.split(/[\s,]+/);
                  if (words[words.length - 1]?.startsWith('#')) setShowTagSuggestions(true);
                }}
                className="bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                placeholder="np. wakacje, dom (oddzielone spacją lub przecinkiem)" 
              />
              {showTagSuggestions && filteredTags.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full max-h-40 overflow-y-auto bg-card border border-border rounded-lg shadow-xl z-50 animate-in slide-in-from-top-2">
                  {filteredTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTagSuggestion(tag)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-foreground transition-colors"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button type="button" onClick={() => setTransactionModalOpen(false)} variant="ghost">Anuluj</Button>
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? "Zapisywanie..." : editingTransactionId ? "Zaktualizuj" : "Zapisz"}
              </Button>
            </div>
          </form>
      </Modal>

      {/* Modal Ostrzegawczy Ujemnego Salda */}
      <Modal
        isOpen={!!pendingOverdraft}
        onClose={() => setPendingOverdraft(null)}
        maxWidth="sm"
        showCloseButton={false}
        closeOnBackdropClick={false}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-5">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-xl font-bold mb-2 tracking-tight text-foreground">Uwaga: Ujemne saldo</h2>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            Ta transakcja spowoduje zejście poniżej zera na koncie <strong>{pendingOverdraft?.accountName}</strong>. Czy na pewno chcesz kontynuować?
          </p>
          <div className="flex w-full gap-3">
            <Button type="button" onClick={() => setPendingOverdraft(null)} variant="secondary" className="flex-1">Anuluj</Button>
            <Button type="button" onClick={() => {
              if (pendingOverdraft) executeTransaction(pendingOverdraft.amount);
            }} variant="danger" className="flex-1">Kontynuuj</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
