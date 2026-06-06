import { Wallet, Sparkles, Database, Plus } from "lucide-react";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

export default function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleGenerateSampleData = async () => {
    try {
      // Seedowanie danych przy użyciu nowych ścisłych typów API (muszą zawierać color, aby uniknąć błędu Serde 'missing field')
      const acc1Id = await api.createAccount({ name: "Konto Osobiste", balance: 5200.00, currency: "PLN", type: "bank", color: "#4f46e5" });
      const acc2Id = await api.createAccount({ name: "Oszczędności", balance: 19700.00, currency: "PLN", type: "savings", color: "#10b981" });
      
      const categories = await api.getCategories();
      const cat = (name: string) => categories.find(c => c.name === name)?.id || 1;
      
      const idWynagrodzenie = cat("Wynagrodzenie");
      const idJedzenie = cat("Jedzenie");
      const idMieszkanie = cat("Mieszkanie");
      const idTransport = cat("Transport");
      const idRozrywka = cat("Rozrywka");

      const now = new Date();
      
      // Generowanie historii z ostatnich 7 miesięcy
      for (let i = 6; i >= 0; i--) {
        const year = now.getFullYear();
        const month = now.getMonth() - i;
        
        const d = (day: number) => {
          const date = new Date(year, month, day, 12, 0, 0); 
          return date.toISOString().split('T')[0];
        };

        const currentMonthStr = d(1).substring(0, 7);

        // Przychód (trochę zmienny)
        const bonus = (Math.random() > 0.7) ? 500 : 0;
        await api.createTransaction({ account_id: acc1Id, category_id: idWynagrodzenie, amount: 7200.00 + bonus, type: "income", date: d(10), description: "Wypłata z firmy" + (bonus ? " + Premia" : ""), transfer_to_id: undefined });

        // Stałe wydatki
        await api.createTransaction({ account_id: acc1Id, category_id: idMieszkanie, amount: 2500.00, type: "expense", date: d(5), description: "Czynsz i media", transfer_to_id: undefined });
        await api.createTransaction({ account_id: acc1Id, category_id: idRozrywka, amount: 64.99, type: "expense", date: d(12), description: "Netflix & Spotify", transfer_to_id: undefined });

        // Jedzenie (zmienne w każdym miesiącu)
        const jedzenie1 = 200 + Math.random() * 200;
        const jedzenie2 = 100 + Math.random() * 150;
        const jedzenie3 = 150 + Math.random() * 200;
        const jedzenie4 = 50 + Math.random() * 100;
        await api.createTransaction({ account_id: acc1Id, category_id: idJedzenie, amount: jedzenie1, type: "expense", date: d(3), description: "Lidl - duże zakupy", transfer_to_id: undefined });
        await api.createTransaction({ account_id: acc1Id, category_id: idJedzenie, amount: jedzenie2, type: "expense", date: d(15), description: "Biedronka", transfer_to_id: undefined });
        await api.createTransaction({ account_id: acc1Id, category_id: idJedzenie, amount: jedzenie3, type: "expense", date: d(24), description: "Auchan", transfer_to_id: undefined });
        await api.createTransaction({ account_id: acc1Id, category_id: idJedzenie, amount: jedzenie4, type: "expense", date: d(28), description: "Żabka", transfer_to_id: undefined });

        // Transport
        await api.createTransaction({ account_id: acc1Id, category_id: idTransport, amount: 200.00, type: "expense", date: d(8), description: "Paliwo Orlen", transfer_to_id: undefined });
        if (Math.random() > 0.3) {
          await api.createTransaction({ account_id: acc1Id, category_id: idTransport, amount: 150.00, type: "expense", date: d(22), description: "Paliwo BP", transfer_to_id: undefined });
        }
        
        // Oszczędności
        await api.createTransaction({ account_id: acc1Id, category_id: undefined, amount: 1000.00, type: "transfer", date: d(28), description: "Odkładanie na poduszkę", transfer_to_id: acc2Id });

        // Dodawanie Budżetów dla tego miesiąca
        await api.upsertBudget({ category_id: idJedzenie, month: currentMonthStr, amount: 1500.00 });
        await api.upsertBudget({ category_id: idTransport, month: currentMonthStr, amount: 400.00 });
        await api.upsertBudget({ category_id: idRozrywka, month: currentMonthStr, amount: 300.00 });
        await api.upsertBudget({ category_id: idMieszkanie, month: currentMonthStr, amount: 2600.00 });
      }

      // Dodawanie Subskrypcji
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextDate = (day: number) => new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day, 12, 0, 0).toISOString().split('T')[0];
      
      await api.createRecurring({ name: "Netflix", amount: 43.00, category_id: idRozrywka, account_id: acc1Id, frequency: "monthly", next_date: nextDate(12), day_of_month: 12 });
      await api.createRecurring({ name: "Spotify Premium", amount: 21.99, category_id: idRozrywka, account_id: acc1Id, frequency: "monthly", next_date: nextDate(15), day_of_month: 15 });
      await api.createRecurring({ name: "Czynsz", amount: 2500.00, category_id: idMieszkanie, account_id: acc1Id, frequency: "monthly", next_date: nextDate(5), day_of_month: 5 });

      // Dodawanie Celów
      const deadline1 = new Date(now.getFullYear() + 1, 6, 1, 12, 0, 0).toISOString().split('T')[0];
      const deadline2 = new Date(now.getFullYear(), 11, 20, 12, 0, 0).toISOString().split('T')[0];
      await api.createGoal({ name: "Wakacje w Japonii", target_amount: 15000.00, deadline: deadline1, color: "#ff9f43", icon: "Plane" });
      await api.createGoal({ name: "Nowy Laptop", target_amount: 8000.00, deadline: deadline2, color: "#54a0ff", icon: "Laptop" });
      
      await queryClient.invalidateQueries(); // Wymuszenie odświeżenia store'a
      navigate("/");
    } catch (error) {
      console.error("Błąd podczas generowania danych:", error);
      alert("Błąd podczas generowania danych: " + error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] animate-in fade-in zoom-in-95 duration-700">
      <div className="w-20 h-20 bg-gradient-to-br from-primary to-indigo-500 rounded-3xl flex items-center justify-center text-primary-foreground shadow-2xl shadow-primary/30 mb-8 transform hover:scale-110 transition-transform duration-500 cursor-pointer">
        <Wallet size={40} strokeWidth={2} />
      </div>
      
      <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/70 text-center max-w-2xl leading-tight mb-4">
        Witaj w Twoim nowym<br/>centrum finansowym.
      </h1>
      
      <p className="text-muted-foreground text-lg text-center max-w-lg mb-12">
        Wygląda na to, że Twoja baza danych jest zupełnie pusta. Dodaj swoje pierwsze konto, aby rozpocząć zarządzanie budżetem, lub wygeneruj przykładowe dane, aby zobaczyć możliwości aplikacji.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button 
          onClick={() => {
            navigate("/accounts?new=1");
          }}
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-4 rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
        >
          <Plus size={20} />
          Dodaj Pierwsze Konto
        </button>
        
        <button 
          onClick={handleGenerateSampleData}
          className="flex-1 flex items-center justify-center gap-2 bg-card text-foreground border border-border px-6 py-4 rounded-xl font-medium shadow-sm hover:bg-muted/50 hover:-translate-y-0.5 transition-all"
        >
          <Sparkles size={20} className="text-indigo-500" />
          Testowe Dane
        </button>
      </div>
      
      <div className="mt-16 flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-4 py-2 rounded-full border border-border/50">
        <Database size={14} /> Twoje dane pozostają w 100% lokalnie i bezpiecznie na Twoim komputerze.
      </div>
    </div>
  );
}
