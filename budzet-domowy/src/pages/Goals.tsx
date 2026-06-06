import { useState, useEffect } from "react";
import { useDialogStore } from "../store/useDialogStore";
import { Plus, Target, Wallet, Trash2, AlertTriangle, Trophy } from "lucide-react";
import { useGoals, useAccounts, useCreateGoal, useDeleteGoal, useAddToGoal } from "../lib/queries";
import { useTheme } from "../store/ThemeProvider";

export default function Goals() {
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    setIsDark(
      theme === "dark" || 
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  }, [theme]);

  const { data: goals = [], isLoading } = useGoals();
  const { data: accounts = [] } = useAccounts();
  const createGoalMutation = useCreateGoal();
  const deleteGoalMutation = useDeleteGoal();
  const addToGoalMutation = useAddToGoal();
  const { showConfirm } = useDialogStore();

  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [pendingOverdraft, setPendingOverdraft] = useState<{ amount: number, accountName: string } | null>(null);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    await createGoalMutation.mutateAsync({
      name,
      target_amount: parseFloat(targetAmount),
      deadline: deadline || undefined,
      icon: "Target",
      color: "#8b5cf6"
    });
    setIsCreateModalOpen(false);
    setName("");
    setTargetAmount("");
    setDeadline("");
  };

  const executeDeposit = async (parsedAmount: number) => {
    if (!selectedGoalId || !accountId) return;
    
    await addToGoalMutation.mutateAsync({
      goal_id: selectedGoalId,
      amount: parsedAmount,
      account_id: parseInt(accountId),
      date: new Date().toISOString().substring(0, 10)
    });
    
    setIsDepositModalOpen(false);
    setDepositAmount("");
    setAccountId("");
    setPendingOverdraft(null);
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalId || !accountId) return;

    const parsedAmount = parseFloat(depositAmount);
    const selectedAccount = accounts.find(a => a.id === parseInt(accountId));
    
    if (selectedAccount && selectedAccount.balance < parsedAmount) {
      setPendingOverdraft({ amount: parsedAmount, accountName: selectedAccount.name });
      return;
    }
    
    await executeDeposit(parsedAmount);
  };

  const handleDelete = (id: number, name: string) => {
    showConfirm(
      "Usuwanie Celu",
      `Czy na pewno chcesz bezpowrotnie usunąć cel "${name}"?`,
      () => deleteGoalMutation.mutate(id)
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Cele oszczędnościowe</h1>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus size={16} /> Nowy cel
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center p-8"><p className="text-muted-foreground animate-pulse">Ładowanie celów...</p></div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map(goal => {
          const isCompleted = goal.current_amount >= goal.target_amount;
          
          return (
            <div key={goal.id} className="p-6 bg-card border border-border/80 rounded-2xl shadow-sm flex flex-col relative overflow-hidden group transition-all duration-300 hover:shadow-md ring-1 ring-transparent hover:ring-primary/20">
              <div className="absolute -right-8 -top-8 text-primary opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                {isCompleted ? <Trophy size={140} /> : <Target size={140} />}
              </div>
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl shadow-inner border border-border/50 ${isCompleted ? 'bg-emerald-500/20 text-emerald-500' : 'bg-primary/20 text-primary'}`}>
                    {isCompleted ? <Trophy size={24} /> : <Target size={24} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{goal.name}</h3>
                    {goal.deadline && <p className="text-xs font-medium text-muted-foreground">Do: {goal.deadline}</p>}
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(goal.id, goal.name)}
                  className="text-muted-foreground opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all p-2 rounded-xl z-20 print:hidden"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              <div className="mt-auto relative z-10">
                <div className="flex justify-between text-sm mb-2 items-end">
                  <span className="font-bold text-lg text-foreground">{goal.current_amount.toFixed(2)} PLN</span>
                  <span className="text-xs font-medium text-muted-foreground">z {goal.target_amount.toFixed(2)} PLN</span>
                </div>
                <div className="w-full bg-muted/50 rounded-full h-3 mb-6 overflow-hidden border border-border/50 shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden`}
                    style={{ 
                      width: `${Math.max(0, Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100)) || 0}%`, 
                      backgroundColor: isCompleted ? '#10b981' : (goal.color || 'var(--color-primary)')
                    }}
                  >
                    {/* Połysk na pasku */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full h-full animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>
                
                <button 
                  onClick={() => { setSelectedGoalId(goal.id); setIsDepositModalOpen(true); }}
                  disabled={isCompleted}
                  className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-sm ${isCompleted ? 'bg-muted/50 text-muted-foreground cursor-not-allowed border border-border/50' : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'}`}
                >
                  <Wallet size={18} /> {isCompleted ? 'Cel osiągnięty!' : 'Wpłać środki'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setIsCreateModalOpen(false)}>
          <div className="bg-[var(--color-card)] border border-border/50 p-8 rounded-2xl shadow-2xl shadow-primary/5 w-full max-w-md animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-6 tracking-tight">Nowy cel oszczędnościowy</h2>
            <form onSubmit={handleCreateGoal} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Nazwa celu</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="np. Wyjazd w góry" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Kwota docelowa (PLN)</label>
                <input required type="number" step="0.01" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Data końcowa (opcjonalnie)</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Anuluj</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Utwórz cel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setIsDepositModalOpen(false)}>
          <div className="bg-[var(--color-card)] border border-border/50 p-8 rounded-2xl shadow-2xl shadow-primary/5 w-full max-w-md animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-6 tracking-tight">Wpłać na skarbonkę</h2>
            <form onSubmit={handleDeposit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Konto źródłowe</label>
                <select required value={accountId} onChange={e => setAccountId(e.target.value)} className="bg-background text-foreground border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">Wybierz konto...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.balance.toFixed(2)} PLN)</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Kwota wpłaty (PLN)</label>
                <input required type="number" step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2 bg-muted/50 p-3 rounded-lg border border-border">
                Wskazana kwota zostanie odjęta z Twojego portfela w postaci standardowego wydatku.
              </p>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsDepositModalOpen(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Anuluj</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">Potwierdź wpłatę</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ostrzegawczy Ujemnego Salda */}
      {pendingOverdraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setPendingOverdraft(null)}>
          <div className="bg-[var(--color-card)] border border-red-500/30 p-8 rounded-2xl shadow-2xl shadow-red-500/10 w-full max-w-sm animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-5">
              <AlertTriangle size={24} />
            </div>
            <h2 className="text-xl font-bold mb-2 tracking-tight text-foreground">Uwaga: Ujemne saldo</h2>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              Ta wpłata spowoduje, że na koncie <span className="font-semibold text-foreground">"{pendingOverdraft.accountName}"</span> zabraknie środków (saldo ujemne).
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
                onClick={() => executeDeposit(pendingOverdraft.amount)} 
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 shadow-md shadow-red-500/20 transition-all"
              >
                Tak, zasil cel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
