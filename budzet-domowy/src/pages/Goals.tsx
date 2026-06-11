import { useState } from "react";
import { useDialogStore } from "../store/useDialogStore";
import { Plus, Target, Wallet, Trash2, AlertTriangle, Trophy, Pencil, Calendar, TrendingUp } from "lucide-react";
import { useGoals, useAccounts, useCreateGoal, useDeleteGoal, useAddToGoal, useUpdateGoal } from "../lib/queries";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";

export default function Goals() {
  const { data: goals = [], isLoading } = useGoals();
  const { data: accounts = [] } = useAccounts();
  const createGoalMutation = useCreateGoal();
  const updateGoalMutation = useUpdateGoal();
  const deleteGoalMutation = useDeleteGoal();
  const addToGoalMutation = useAddToGoal();
  const { showConfirm, showAlert } = useDialogStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [pendingOverdraft, setPendingOverdraft] = useState<{ amount: number, accountName: string } | null>(null);

  const openCreateModal = () => {
    setEditingId(null);
    setName("");
    setTargetAmount("");
    setDeadline("");
    setCurrentAmount("0");
    setIsModalOpen(true);
  };

  const openEditModal = (goal: any) => {
    setEditingId(goal.id);
    setName(goal.name);
    setTargetAmount(goal.target_amount.toString());
    setCurrentAmount(goal.current_amount.toString());
    setDeadline(goal.deadline || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateGoalMutation.mutateAsync({
          id: editingId,
          payload: {
            name,
            target_amount: parseFloat(targetAmount),
            current_amount: parseFloat(currentAmount),
            deadline: deadline || undefined,
          }
        });
      } else {
        await createGoalMutation.mutateAsync({
          name,
          target_amount: parseFloat(targetAmount),
          deadline: deadline || undefined,
          icon: "Target",
          color: "#8b5cf6"
        });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setName("");
      setTargetAmount("");
      setDeadline("");
    } catch (error: any) {
      showAlert(editingId ? "Błąd Edycji Celu" : "Błąd Tworzenia Celu", error.toString());
    }
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
        <Button 
          onClick={openCreateModal}
          variant="primary"
        >
          <Plus size={16} /> Nowy cel
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center p-8"><p className="text-muted-foreground animate-pulse">Ładowanie celów...</p></div>
      )}

      {!isLoading && goals.length === 0 ? (
        <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl">
          <EmptyState 
            icon={Target}
            title="Brak celów oszczędnościowych"
            description="Dodaj swój pierwszy cel oszczędnościowy, aby zacząć śledzić postępy."
            action={<Button onClick={openCreateModal} variant="primary"><Plus size={16} /> Nowy cel</Button>}
          />
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map(goal => {
          const isCompleted = goal.current_amount >= goal.target_amount;
          
          return (
            <div 
              key={goal.id} 
              className={`p-6 bg-card/60 backdrop-blur-md rounded-2xl shadow-sm flex flex-col relative overflow-hidden group transition-all duration-300 hover:shadow-md ring-1 ring-transparent hover:ring-primary/20 ${
                isCompleted 
                  ? 'border-2 border-amber-500/60 dark:border-amber-400/30 bg-gradient-to-br from-amber-500/[0.05] dark:from-amber-500/[0.03] to-card shadow-md shadow-amber-500/[0.03]' 
                  : 'border border-border/80'
              }`}
            >
              <div className={`absolute -right-8 -top-8 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 ${isCompleted ? 'text-amber-500' : 'text-primary'}`}>
                {isCompleted ? <Trophy size={140} /> : <Target size={140} />}
              </div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl shadow-inner border border-border/50 ${isCompleted ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-primary/20 text-primary'}`}>
                    {isCompleted ? <Trophy size={24} /> : <Target size={24} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-lg text-foreground pr-8">{goal.name}</h3>
                      {isCompleted && (
                        <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30 shrink-0">
                          Sukces! 🏆
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(goal)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 hover:scale-110 transition-all p-1.5 rounded-lg cursor-pointer">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(goal.id, goal.name)} className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 hover:scale-110 transition-all p-1.5 rounded-lg cursor-pointer">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {goal.deadline && !isCompleted && (() => {
                const today = new Date();
                const deadlineDate = new Date(goal.deadline);
                
                const yearDiff = deadlineDate.getFullYear() - today.getFullYear();
                const monthDiff = deadlineDate.getMonth() - today.getMonth();
                const diffMonths = yearDiff * 12 + monthDiff;
                
                const isOverdue = diffMonths < 0 && !isCompleted;
                const remainingMonths = diffMonths < 0 ? 0 : diffMonths + 1;
                
                let badgeText = "";
                let badgeClass = "";
                
                if (isOverdue) {
                  badgeText = "Termin minął";
                  badgeClass = "bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400 border border-red-500/20";
                } else if (remainingMonths === 1) {
                  badgeText = "Ostatni miesiąc";
                  badgeClass = "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20";
                } else {
                  const lastDigit = remainingMonths % 10;
                  const lastTwoDigits = remainingMonths % 100;
                  let monthsWord = "miesięcy";
                  let prefix = "Pozostało";
                  
                  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) {
                    monthsWord = "miesiące";
                    prefix = "Pozostały";
                  } else if (remainingMonths === 1) {
                    monthsWord = "miesiąc";
                    prefix = "Pozostał";
                  }
                  
                  badgeText = `${prefix} ${remainingMonths} ${monthsWord}`;
                  badgeClass = "bg-primary/10 text-primary border border-primary/20";
                }
                
                const calcRemainingMonths = diffMonths <= 0 ? 1 : diffMonths + 1;
                const remainingToSave = Math.max(0, goal.target_amount - goal.current_amount);
                const suggestedMonthly = remainingToSave / calcRemainingMonths;
                
                return (
                  <div className="mb-5 space-y-3 relative z-10 bg-muted/20 border border-border/40 rounded-xl p-3.5 shadow-inner">
                    <div className="flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                        <Calendar size={14} className="text-muted-foreground/60 shrink-0" />
                        <span>Termin celu: <span className="font-semibold text-foreground">{goal.deadline}</span></span>
                      </div>
                      <div>
                        <span className={`inline-flex items-center text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeClass}`}>
                          {badgeText}
                        </span>
                      </div>
                    </div>
                    
                    {!isCompleted && suggestedMonthly > 0 && !isOverdue && (
                      <div className="border-t border-border/40 pt-3">
                        <div className="flex flex-col gap-2 bg-indigo-100/70 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-900/40 rounded-xl p-3 shadow-inner-sm">
                          <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp size={14} className="text-indigo-600 dark:text-indigo-400" />
                            <span>Sugerowana wpłata:</span>
                          </div>
                          <div className="text-sm font-black text-indigo-800 dark:text-indigo-300">
                            {suggestedMonthly.toFixed(2)} PLN <span className="text-[10px] opacity-75 font-bold">/ mc</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              
              <div className="mt-auto relative z-10">
                <div className="flex justify-between text-sm mb-2 items-end">
                  <span className="font-bold text-lg text-foreground">{goal.current_amount.toFixed(2)} PLN</span>
                  <span className="text-xs font-medium text-muted-foreground">z {goal.target_amount.toFixed(2)} PLN</span>
                </div>
                 <div className="w-full bg-muted/50 rounded-full h-3 mb-6 overflow-hidden border border-border/50 shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ease-out`}
                    style={{ 
                      width: `${Math.max(0, Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100)) || 0}%`, 
                      backgroundColor: isCompleted ? '#f59e0b' : (goal.color || 'var(--color-primary)')
                    }}
                  />
                </div>
                
                <button 
                  onClick={() => { setSelectedGoalId(goal.id); setIsDepositModalOpen(true); }}
                  disabled={isCompleted}
                  className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all duration-300 transform shadow-sm hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.98] ${
                    isCompleted 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-500/30 cursor-not-allowed shadow-inner' 
                      : 'bg-indigo-100/70 text-indigo-700 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-500 dark:hover:text-slate-950 border border-indigo-200/80 dark:border-indigo-900/40 hover:border-transparent cursor-pointer'
                  }`}
                >
                  {isCompleted ? <Trophy size={18} /> : <Wallet size={18} />} {isCompleted ? 'Cel osiągnięty! 🏆' : 'Wpłać środki'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingId ? "Edytuj cel" : "Nowy cel oszczędnościowy"}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Nazwa celu</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="np. Wyjazd w góry" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Kwota docelowa (PLN)</label>
            <input required type="number" step="0.01" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Data końcowa (opcjonalnie)</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" onClick={() => setIsModalOpen(false)} variant="ghost">Anuluj</Button>
            <Button type="submit" variant="primary">Zapisz</Button>
          </div>
        </form>
      </Modal>

      {isDepositModalOpen && (() => {
        const selectedGoal = goals.find(g => g.id === selectedGoalId);
        let suggestedAmount = 0;
        let remainingAmount = 0;
        
        if (selectedGoal) {
          remainingAmount = Math.max(0, selectedGoal.target_amount - selectedGoal.current_amount);
          if (selectedGoal.deadline) {
            const today = new Date();
            const deadlineDate = new Date(selectedGoal.deadline);
            const yearDiff = deadlineDate.getFullYear() - today.getFullYear();
            const monthDiff = deadlineDate.getMonth() - today.getMonth();
            const diffMonths = yearDiff * 12 + monthDiff;
            const remainingMonths = diffMonths <= 0 ? 1 : diffMonths + 1;
            suggestedAmount = remainingAmount / remainingMonths;
          }
        }

        return (
          <Modal
            isOpen={isDepositModalOpen}
            onClose={() => setIsDepositModalOpen(false)}
            title="Wpłać na skarbonkę"
            maxWidth="md"
          >
            <form onSubmit={handleDeposit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Konto źródłowe</label>
                <select required value={accountId} onChange={e => setAccountId(e.target.value)} className="bg-background text-foreground border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">Wybierz konto...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.balance.toFixed(2)} PLN)</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Kwota wpłaty (PLN)</label>
                <input required type="number" step="0.01" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                
                {selectedGoal && (
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {suggestedAmount > 0 && suggestedAmount < remainingAmount && (
                      <button
                        type="button"
                        onClick={() => setDepositAmount(suggestedAmount.toFixed(2))}
                        className="flex-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer border border-primary/10 whitespace-nowrap text-center"
                      >
                        Sugerowana wpłata: {suggestedAmount.toFixed(2)} zł
                      </button>
                    )}
                    {remainingAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setDepositAmount(remainingAmount.toFixed(2))}
                        className="flex-1 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer border border-amber-500/10 whitespace-nowrap text-center"
                      >
                        Uzupełnij do celu: {remainingAmount.toFixed(2)} zł
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2 bg-muted/50 p-3 rounded-xl border border-border">
                Wskazana kwota zostanie odjęta z Twojego portfela w postaci standardowego wydatku.
              </p>
              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" onClick={() => setIsDepositModalOpen(false)} variant="ghost">Anuluj</Button>
                <Button type="submit" variant="primary">Potwierdź wpłatę</Button>
              </div>
            </form>
          </Modal>
        );
      })()}

      {/* Modal Ostrzegawczy Ujemnego Salda */}
      <Modal
        isOpen={!!pendingOverdraft}
        onClose={() => setPendingOverdraft(null)}
        maxWidth="sm"
        showCloseButton={false}
      >
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-5">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-xl font-bold mb-2 tracking-tight text-foreground">Uwaga: Ujemne saldo</h2>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          Ta wpłata spowoduje, że na koncie <span className="font-semibold text-foreground">"{pendingOverdraft?.accountName}"</span> zabraknie środków (saldo ujemne).
          <br/><br/>
          Czy na pewno chcesz kontynuować i wejść na debet?
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" onClick={() => setPendingOverdraft(null)} variant="ghost">Anuluj</Button>
          <Button type="button" onClick={() => pendingOverdraft && executeDeposit(pendingOverdraft.amount)} variant="danger">Tak, zasil cel</Button>
        </div>
      </Modal>
    </div>
  );
}
