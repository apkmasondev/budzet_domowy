import { Wallet, LayoutDashboard, ArrowLeftRight, Settings as SettingsIcon, Landmark, Target, PieChart, Repeat, FileUp, LineChart as LineChartIcon } from "lucide-react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import Accounts from "./pages/Accounts";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Goals from "./pages/Goals";
import Dashboard from "./pages/Dashboard";
import Subscriptions from "./pages/Subscriptions";
import Settings from "./pages/Settings";
import Import from "./pages/Import";
import Reports from "./pages/Reports";
import LockScreen from "./pages/LockScreen";
import GlobalTransactionModal from "./components/modals/GlobalTransactionModal";
import GlobalDialogs from "./components/modals/GlobalDialogs";
import Onboarding from "./pages/Onboarding";
import { useFinanceStore } from "./store/useFinanceStore";
import { useAccounts } from "./lib/queries";
import { useEffect } from "react";

export default function App() {
  const { checkAuthStatus, hasPin, isUnlocked, setTransactionModalOpen } = useFinanceStore();
  const { data: accounts = [], isPending: areAccountsLoading } = useAccounts();

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Space or Cmd+Space
      if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
        e.preventDefault(); // Zapobiega przewijaniu strony spacją
        if (isUnlocked || !hasPin) {
          setTransactionModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isUnlocked, hasPin, setTransactionModalOpen]);

  return (
    <Router>
      {hasPin && !isUnlocked && <LockScreen />}
      
      <div className={`flex h-screen w-full bg-background text-foreground overflow-hidden print:h-auto print:overflow-visible print:block ${hasPin && !isUnlocked ? 'hidden' : ''}`}>
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-card/40 backdrop-blur-xl flex flex-col z-20 print:hidden">
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <Wallet size={18} strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg tracking-tight">Domowy Budżet</span>
          </div>
          <nav className="flex-1 px-4 flex flex-col gap-2 mt-4">
            <NavLink to="/" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <LayoutDashboard size={18} /> Dashboard
            </NavLink>
            <NavLink to="/accounts" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Landmark size={18} /> Konta i Portfele
            </NavLink>
            <NavLink to="/transactions" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <ArrowLeftRight size={18} /> Transakcje
            </NavLink>
            <NavLink to="/budgets" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <PieChart size={20} /> Budżety
            </NavLink>
            <NavLink to="/goals" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Target size={20} /> Skarbonki i Cele
            </NavLink>
            <NavLink to="/subscriptions" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Repeat size={20} /> Subskrypcje
            </NavLink>
            <NavLink to="/import" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <FileUp size={20} /> Import CSV
            </NavLink>
            <NavLink to="/reports" className={({isActive}) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <LineChartIcon size={20} /> Raporty i Analityka
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <SettingsIcon size={18} /> Ustawienia
            </NavLink>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-8 relative print:overflow-visible print:h-auto print:p-0">
          {/* Subtle gradient background effects for modern look */}
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none print:hidden" />
          <div className="absolute top-1/2 -left-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none print:hidden" />
          
          <Routes>
            {/* Dopóki lista kont się ładuje, `accounts` jest pustą tablicą — bez tego
                warunku ekran powitalny mrugał na starcie u każdego istniejącego użytkownika. */}
            <Route
              path="/"
              element={
                areAccountsLoading ? (
                  <div className="flex justify-center p-8">
                    <p className="text-muted-foreground animate-pulse">Ładowanie kokpitu...</p>
                  </div>
                ) : accounts.length === 0 ? (
                  <Onboarding />
                ) : (
                  <Dashboard />
                )
              }
            />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/import" element={<Import />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
      <GlobalTransactionModal />
      <GlobalDialogs />
    </Router>
  );
}
