import { useState } from "react";
import { useDialogStore } from "../store/useDialogStore";
import { Plus, Repeat, Trash2, Calendar, CreditCard, Layers, Bot, EyeOff } from "lucide-react";
import { useCategories, useAccounts, useRecurrings, useAddRecurring, useDeleteRecurring, useRecurringSuggestions, useIgnoreSubscriptionSuggestion } from "../lib/queries";

export default function Subscriptions() {
  const { data: recurrings = [], isLoading } = useRecurrings();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: suggestions = [] } = useRecurringSuggestions();
  const addRecurringMutation = useAddRecurring();
  const deleteRecurringMutation = useDeleteRecurring();
  const ignoreSuggestionMutation = useIgnoreSubscriptionSuggestion();
  
  const { showConfirm } = useDialogStore();
  const expenseCategories = categories.filter(c => c.type === "expense" || c.type === "both");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  
  const defaultFormData = {
    name: "",
    amount: "",
    category_id: "",
    account_id: "",
    frequency: "monthly",
    next_date: new Date().toISOString().split('T')[0],
    day_of_month: new Date().getDate().toString()
  };
  const [formData, setFormData] = useState(defaultFormData);

  const openModalWithSuggestion = (sug: any) => {
    let nextDateStr = new Date().toISOString().split('T')[0];
    let dom = new Date().getDate().toString();
    if (sug.last_date) {
      const d = new Date(sug.last_date);
      d.setMonth(d.getMonth() + 1);
      nextDateStr = d.toISOString().split('T')[0];
      dom = d.getDate().toString();
    }
    setFormData({
      name: sug.description,
      amount: sug.amount.toFixed(2),
      category_id: sug.category_id ? sug.category_id.toString() : "",
      account_id: sug.account_id ? sug.account_id.toString() : "",
      frequency: "monthly",
      next_date: nextDateStr,
      day_of_month: dom
    });
    setActiveSuggestion(sug.description);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addRecurringMutation.mutateAsync({
      name: formData.name,
      amount: parseFloat(formData.amount),
      category_id: formData.category_id ? parseInt(formData.category_id) : undefined,
      account_id: formData.account_id ? parseInt(formData.account_id) : undefined,
      frequency: formData.frequency,
      next_date: formData.next_date,
      day_of_month: parseInt(formData.day_of_month)
    });
    
    if (activeSuggestion) {
      ignoreSuggestionMutation.mutate(activeSuggestion);
    }
    
    setIsModalOpen(false);
    setActiveSuggestion(null);
    setFormData(defaultFormData);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8 relative z-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Subskrypcje i opłaty
          </h1>
          <p className="text-muted-foreground mt-1">Zarządzaj płatnościami cyklicznymi, które księgują się same.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <Plus size={20} />
          Nowa subskrypcja
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400">
            <Bot size={24} />
            <h2 className="text-xl font-bold">Inteligentne Sugestie Subskrypcji</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suggestions.map((sug, idx) => (
              <div key={idx} className="bg-gradient-to-br from-emerald-500/10 to-indigo-500/10 dark:from-emerald-500/20 dark:to-indigo-500/20 backdrop-blur-xl border border-emerald-500/30 p-6 rounded-2xl shadow-lg relative overflow-hidden print:hidden flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg mb-1 line-clamp-2">{sug.description}</h3>
                  <p className="text-2xl font-black mb-2 text-foreground">{sug.amount.toFixed(2)} PLN</p>
                  <p className="text-sm opacity-80 mb-6">Wykryto powtarzalną płatność. Średnio co miesiąc.</p>
                </div>
                <div className="flex gap-2 mt-auto">
                  <button 
                    onClick={() => openModalWithSuggestion(sug)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors shadow-md"
                  >
                    Dodaj
                  </button>
                  <button 
                    onClick={() => showConfirm("Ignoruj", `Czy na pewno chcesz na zawsze ukryć sugestię dla "${sug.description}"?`, () => ignoreSuggestionMutation.mutate(sug.description))}
                    className="flex items-center justify-center bg-card hover:bg-muted text-muted-foreground border border-border px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                    title="Nie pokazuj ponownie"
                  >
                    <EyeOff size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center p-8"><p className="text-muted-foreground animate-pulse">Ładowanie subskrypcji...</p></div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recurrings.map(rec => {
          const cat = categories.find(c => c.id === rec.category_id);
          const acc = accounts.find(a => a.id === rec.account_id);
          return (
            <div key={rec.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm relative group overflow-hidden print:break-inside-avoid">
              <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: cat?.color || '#3b82f6' }} />
              
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-muted">
                  <Repeat size={24} className="text-muted-foreground" />
                </div>
                <button 
                  onClick={() => showConfirm("Usuwanie subskrypcji", `Czy na pewno chcesz usunąć stałą opłatę "${rec.name}"?`, () => deleteRecurringMutation.mutate(rec.id))}
                  className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 print:hidden"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              <h3 className="font-bold text-xl mb-1">{rec.name}</h3>
              <p className="text-2xl font-black mb-4">{rec.amount.toFixed(2)} PLN</p>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  <span>Co miesiąc (dzień: {rec.day_of_month})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers size={16} />
                  <span>Kategoria: {cat?.name || 'Brak'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard size={16} />
                  <span>Konto: {acc?.name || 'Brak'}</span>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-border/50 text-sm">
                <span className="text-muted-foreground">Następna płatność: </span>
                <span className="font-medium text-foreground">{rec.next_date}</span>
              </div>
            </div>
          );
        })}
        {recurrings.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed border-border rounded-2xl bg-muted/30">
            <Repeat size={48} className="mx-auto text-muted-foreground opacity-50 mb-4" />
            <h3 className="text-xl font-bold mb-2">Brak aktywnych subskrypcji</h3>
            <p className="text-muted-foreground">Dodaj swoje stałe rachunki i zapomnij o ich ręcznym księgowaniu.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => { setIsModalOpen(false); setActiveSuggestion(null); }}>
          <div className="bg-[var(--color-card)] border border-border/50 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-bold">Nowa Płatność Cykliczna</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nazwa (np. Netflix, Czynsz)</label>
                <input required type="text" className="w-full bg-background border border-border rounded-xl px-4 py-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kwota (PLN)</label>
                <input required type="number" step="0.01" className="w-full bg-background border border-border rounded-xl px-4 py-2" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Konto obciążane</label>
                <select required className="w-full bg-background border border-border rounded-xl px-4 py-2" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                  <option value="">Wybierz konto...</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance} {acc.currency})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kategoria</label>
                <select required className="w-full bg-background border border-border rounded-xl px-4 py-2" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                  <option value="">Wybierz kategorię...</option>
                  {expenseCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Pierwsza płatność</label>
                  <input required type="date" className="w-full bg-background border border-border rounded-xl px-4 py-2" value={formData.next_date} onChange={e => setFormData({...formData, next_date: e.target.value, day_of_month: e.target.value.split('-')[2]})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Dzień rozliczenia</label>
                  <input required type="number" min="1" max="31" className="w-full bg-background border border-border rounded-xl px-4 py-2" value={formData.day_of_month} onChange={e => setFormData({...formData, day_of_month: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setIsModalOpen(false); setActiveSuggestion(null); }} className="flex-1 px-4 py-2 border border-border rounded-xl font-medium hover:bg-muted">Anuluj</button>
                <button type="submit" className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-medium hover:bg-primary/90">Zapisz</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
