import { useState } from "react";
import { Download, Upload, AlertTriangle, CheckCircle2, Shield, EyeOff, Tag, Trash2, Power, Palette, Sun, Moon, Monitor, Pencil } from "lucide-react";
import { api } from "../lib/api";
import { useFinanceStore } from "../store/useFinanceStore";
import { useTheme } from "../store/ThemeProvider";
import { useDialogStore } from "../store/useDialogStore";
import { save, open } from "@tauri-apps/plugin-dialog";
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from "../lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";

export default function Settings() {
  const {
    hasPin, setupPin, removePin,
    privacyMode, setPrivacyMode,
    factoryReset
  } = useFinanceStore();
  const { data: categories = [] } = useCategories();
  const createCategoryMutation = useCreateCategory();
  const deleteCategoryMutation = useDeleteCategory();
  const { theme, setTheme } = useTheme();
  const { showConfirm, showAlert } = useDialogStore();
  const queryClient = useQueryClient();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Modal states
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState("");

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState("expense");
  const [catColor, setCatColor] = useState("#8b5cf6");

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filePath = await save({
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        defaultPath: `budzet_backup_${new Date().toISOString().split('T')[0]}.db`
      });

      if (!filePath) {
        setIsExporting(false);
        return; // Anulowano zapis
      }

      await api.exportDb(filePath);
      showMessage('success', 'Pomyślnie zapisano kopię zapasową bazy danych.');
    } catch (error: any) {
      console.error(error);
      showAlert("Błąd Eksportu", "Wystąpił błąd podczas zapisywania pliku: " + error.toString());
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        multiple: false,
      });

      if (!filePath) return;

      showConfirm(
        "Import Bazy Danych",
        "UWAGA: Wgranie nowej bazy bezpowrotnie nadpisze wszystkie aktualne dane (konta, cele, transakcje)! Czy chcesz kontynuować?",
        async () => {
          setIsImporting(true);
          try {
            await api.importDb(filePath);
            showMessage('success', 'Wgrano kopię zapasową. Odświeżanie...');
            setTimeout(() => window.location.reload(), 2000);
          } catch (err: any) {
            showAlert("Błąd Importu", "Nie udało się wgrać pliku bazy danych.");
            setIsImporting(false);
          }
        }
      );
    } catch (err) {
      showAlert("Błąd", "Nie udało się otworzyć pliku.");
    }
  };

  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      showAlert("Błędny PIN", "PIN musi mieć co najmniej 4 cyfry!");
      return;
    }
    await setupPin(newPin);
    setIsPinModalOpen(false);
    setNewPin("");
    showMessage('success', 'Zabezpieczenie PIN zostało aktywowane.');
  };

  const handleRemovePin = () => {
    showConfirm(
      "Usuwanie PINu",
      "Czy na pewno chcesz usunąć zabezpieczenie PIN? Każdy będzie miał wolny dostęp do aplikacji.",
      async () => {
        await removePin();
        showMessage('success', 'Zabezpieczenie PIN zostało usunięte.');
      }
    );
  };

  const updateCategoryMutation = useUpdateCategory();

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategoryId !== null) {
        await updateCategoryMutation.mutateAsync({ id: editingCategoryId, name: catName, type: catType, color: catColor });
        showMessage('success', 'Zaktualizowano kategorię.');
      } else {
        await createCategoryMutation.mutateAsync({ name: catName, type: catType, color: catColor });
        showMessage('success', 'Utworzono nową kategorię.');
      }
      setIsCategoryModalOpen(false);
      setEditingCategoryId(null);
      setCatName("");
      setCatType("expense");
      setCatColor("#8b5cf6");
    } catch (error) {
      showAlert("Błąd", "Nie udało się zapisać kategorii.");
    }
  };

  const openEditCategoryModal = (cat: any) => {
    setEditingCategoryId(cat.id);
    setCatName(cat.name);
    setCatType(cat.type);
    setCatColor(cat.color || "#8b5cf6");
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = (id: number, name: string) => {
    showConfirm(
      "Usuwanie kategorii",
      `Czy na pewno chcesz usunąć kategorię "${name}"? Może to wpłynąć na istniejące transakcje.`,
      () => {
        deleteCategoryMutation.mutate(id, {
          onSuccess: () => showMessage('success', 'Usunięto kategorię.')
        });
      }
    );
  };

  const handleFactoryReset = () => {
    showConfirm(
      "Twardy Reset Aplikacji",
      "UWAGA: Ta operacja BEZPOWROTNIE usunie wszystkie konta, transakcje, subskrypcje, budżety oraz własne kategorie! Aplikacja zostanie zresetowana do ustawień fabrycznych. Jesteś absolutnie pewien?",
      async () => {
        await factoryReset();
        queryClient.clear();
        showMessage('success', 'Aplikacja została przywrócona do ustawień fabrycznych.');
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      }
    );
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Ustawienia</h1>
          <p className="text-muted-foreground mt-1 text-sm">Zarządzaj bezpieczeństwem i personalizacją aplikacji.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' : 'bg-red-500/10 border-red-500/20 text-red-600'}`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Wygląd i Motyw */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/50 bg-muted/10">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Palette size={20} className="text-primary" /> Wygląd i Motyw</h2>
        </div>
        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground">Motyw aplikacji</h3>
              <p className="text-sm text-muted-foreground mt-1">Wybierz preferowany wygląd interfejsu</p>
            </div>
            <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
              <button
                onClick={() => setTheme("light")}
                className={`p-2 rounded-md transition-all ${theme === "light" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                title="Jasny"
              >
                <Sun size={18} />
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`p-2 rounded-md transition-all ${theme === "dark" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                title="Ciemny"
              >
                <Moon size={18} />
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`p-2 rounded-md transition-all ${theme === "system" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                title="Systemowy"
              >
                <Monitor size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bezpieczeństwo i Prywatność */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/50 bg-muted/10">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Shield size={20} className="text-primary" /> Bezpieczeństwo i Prywatność</h2>
        </div>
        <div className="p-6 flex flex-col gap-6">
          {/* PIN */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground">Blokada kodem PIN</h3>
              <p className="text-sm text-muted-foreground mt-1">Zabezpiecz aplikację przed niepowołanym dostępem przy uruchamianiu.</p>
            </div>
            {hasPin ? (
              <Button onClick={handleRemovePin} variant="danger">
                Wyłącz PIN
              </Button>
            ) : (
              <Button onClick={() => setIsPinModalOpen(true)} variant="primary">
                Ustaw PIN
              </Button>
            )}
          </div>

          <div className="w-full h-px bg-border/50"></div>

          {/* Privacy Mode */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground flex items-center gap-2">Tryb Prywatności <EyeOff size={16} className="text-muted-foreground" /></h3>
              <p className="text-sm text-muted-foreground mt-1">Ukrywaj wszystkie salda i kwoty transakcji na ekranach (zamazane gwiazdkami).</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={privacyMode} onChange={(e) => setPrivacyMode(e.target.checked)} />
              <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Kategorie */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/50 bg-muted/10">
          <h2 className="text-xl font-semibold flex items-center gap-2"><Tag size={20} className="text-primary" /> Zarządzanie Kategoriami</h2>
        </div>
        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Dodawaj własne kategorie lub edytuj i usuwaj te, których nie używasz.</p>
            <Button onClick={() => { setEditingCategoryId(null); setCatName(""); setCatType("expense"); setCatColor("#8b5cf6"); setIsCategoryModalOpen(true); }} variant="secondary">
              Dodaj kategorię
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 mt-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 rounded-lg text-sm group">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#6366f1' }}></div>
                <span>{cat.name}</span>
                <div className="flex items-center gap-1.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditCategoryModal(cat)}
                    className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                    title="Edytuj kategorię"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
                    title="Usuń kategorię"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Kopia zapasowa i reset */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/50 bg-muted/10">
          <h2 className="text-xl font-semibold">Dane i Kopia Zapasowa</h2>
        </div>
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground flex items-center gap-2"><Download size={18} className="text-primary" /> Eksport Bazy Danych</h3>
              <p className="text-sm text-muted-foreground mt-1">Zapisz kopię zapasową w formacie .db.</p>
            </div>
            <Button onClick={handleExport} disabled={isExporting} variant="primary">
              Pobierz plik
            </Button>
          </div>

          <div className="w-full h-px bg-border/50"></div>

          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground flex items-center gap-2"><Upload size={18} className="text-amber-500" /> Import Bazy Danych</h3>
              <p className="text-sm text-muted-foreground mt-1">Odtwórz dane z .db (nadpisze wszystkie dane).</p>
            </div>
            <Button onClick={handleImportClick} disabled={isImporting} variant="warning">
              Wgraj plik
            </Button>
          </div>

          <div className="w-full h-px bg-border/50"></div>

          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div>
              <h3 className="font-medium text-red-500 flex items-center gap-2"><Power size={18} /> Twardy Reset</h3>
              <p className="text-sm text-muted-foreground mt-1">Usuwa wszystkie transakcje, konta i budżety. Przywraca apkę do startu.</p>
            </div>
            <Button onClick={handleFactoryReset} variant="danger">
              Wyczyść dane
            </Button>
          </div>
        </div>
      </div>

      {/* PIN Modal */}
      <Modal isOpen={isPinModalOpen} onClose={() => setIsPinModalOpen(false)} title="Ustaw nowy PIN" maxWidth="sm">
        <form onSubmit={handleSetupPin}>
          <input
            type="password"
            required
            maxLength={6}
            pattern="[0-9]*"
            value={newPin}
            onChange={e => setNewPin(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-3 py-3 text-center text-2xl tracking-[1em] focus:outline-none focus:ring-2 focus:ring-primary mb-6"
            placeholder="****"
          />
          <div className="flex justify-end gap-3">
            <Button type="button" onClick={() => setIsPinModalOpen(false)} variant="ghost">Anuluj</Button>
            <Button type="submit" variant="primary">Zapisz PIN</Button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal 
        isOpen={isCategoryModalOpen} 
        onClose={() => { setIsCategoryModalOpen(false); setEditingCategoryId(null); }} 
        title={editingCategoryId !== null ? "Edytuj kategorię" : "Nowa kategoria"} 
        maxWidth="sm"
      >
        <form onSubmit={handleSubmitCategory} className="flex flex-col gap-4">
          <input
            required
            value={catName}
            onChange={e => setCatName(e.target.value)}
            className="bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Nazwa, np. Netflix"
          />
          <select value={catType} onChange={e => setCatType(e.target.value)} className="bg-background border border-border rounded-xl px-3 py-2 text-sm">
            <option value="expense">Wydatek</option>
            <option value="income">Przychód</option>
          </select>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Kolor etykiety:</label>
            <input type="color" value={catColor} onChange={e => setCatColor(e.target.value)} className="h-8 w-14 bg-transparent cursor-pointer rounded" />
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button type="button" onClick={() => { setIsCategoryModalOpen(false); setEditingCategoryId(null); }} variant="ghost">Anuluj</Button>
            <Button type="submit" variant="primary">{editingCategoryId !== null ? "Zapisz" : "Utwórz"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
