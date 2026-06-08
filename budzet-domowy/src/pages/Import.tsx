import { useState, useRef, useMemo } from "react";
import Papa from "papaparse";
import { useAccounts, useTransactions, useBulkAddTransactions, useCategories } from "../lib/queries";
import { FileUp, CheckCircle, AlertTriangle, ArrowRight, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Import() {
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();
  const bulkAddMutation = useBulkAddTransactions();

  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  const [accountId, setAccountId] = useState<string>("");
  const [dateColumn, setDateColumn] = useState<string>("");
  const [amountColumn, setAmountColumn] = useState<string>("");
  const [descColumn, setDescColumn] = useState<string>("");
  const [catColumn, setCatColumn] = useState<string>("");
  
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{success: number, total: number} | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: drop, 2: map cols, 3: map categories
  
  const [uniqueBankCategories, setUniqueBankCategories] = useState<string[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  const processFile = (file: File) => {
    setFile(file);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      let headerRowIdx = 0;
      let detectedDelimiter = ',';

      // Scan first 30 lines to find the header row
      for (let i = 0; i < Math.min(30, lines.length); i++) {
        const line = lines[i].toLowerCase();
        if ((line.includes(';') || line.includes(',')) && 
            (line.includes('data') || line.includes('kwota') || line.includes('opis') || line.includes('tytuł') || line.includes('saldo'))) {
          headerRowIdx = i;
          detectedDelimiter = lines[i].includes(';') ? ';' : ',';
          break;
        }
      }

      // Slice off the metadata lines above the header
      const relevantLines = lines.slice(headerRowIdx).join('\n');

      Papa.parse(relevantLines, {
        header: true,
        delimiter: detectedDelimiter,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setCsvData(results.data as Record<string, string>[]);
            const cols = Object.keys(results.data[0] as object);
            setHeaders(cols);
            
            const dateGuess = cols.find(c => c.toLowerCase().includes("data") || c.toLowerCase().includes("date"));
            const amountGuess = cols.find(c => c.toLowerCase().includes("kwota") || c.toLowerCase().includes("amount") || c.toLowerCase().includes("saldo"));
            const descGuess = cols.find(c => c.toLowerCase().includes("tytuł") || c.toLowerCase().includes("opis") || c.toLowerCase().includes("title") || c.toLowerCase().includes("description"));
            const catGuess = cols.find(c => c.toLowerCase().includes("kategoria") || c.toLowerCase().includes("category") || c.toLowerCase().includes("typ"));
            
            if (dateGuess) setDateColumn(dateGuess);
            if (amountGuess) setAmountColumn(amountGuess);
            if (descGuess) setDescColumn(descGuess);
            if (catGuess) setCatColumn(catGuess);
            
            setStep(2);
          }
        }
      });
    };
    
    // Read as windows-1250 (common for Polish banks like mBank, PKO, etc.)
    reader.readAsText(file, 'windows-1250');
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  // Build a fast lookup for categories based on exact description match from history
  const categoryLookup = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach(t => {
      if (t.description && t.category_id) {
        map.set(t.description.trim().toLowerCase(), t.category_id);
      }
    });
    return map;
  }, [transactions]);

  const parseAmount = (val: string): number => {
    if (!val) return 0;
    // Remove spaces, replace comma with dot
    const clean = val.replace(/\s/g, '').replace(',', '.');
    // Remove non-numeric chars except dot and minus
    const num = parseFloat(clean.replace(/[^\d.-]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const parseDate = (val: string): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    // Polish formats: DD.MM.YYYY, DD-MM-YYYY, YYYY-MM-DD
    if (val.match(/^\d{4}-\d{2}-\d{2}/)) return val.substring(0, 10);
    const parts = val.split(/[./-]/);
    if (parts.length >= 3) {
      if (parts[2].length === 4) {
        // DD.MM.YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return new Date().toISOString().split('T')[0]; // fallback
  };

  const handlePrepareCategories = () => {
    if (!accountId || !dateColumn || !amountColumn || !descColumn) return;
    
    if (catColumn) {
      const uniqueCats = new Set<string>();
      csvData.forEach(row => {
        const catVal = row[catColumn];
        if (catVal && catVal.trim()) uniqueCats.add(catVal.trim());
      });
      const uniqueCatsArr = Array.from(uniqueCats).sort();
      setUniqueBankCategories(uniqueCatsArr);

      // Algorytm propozycji przypisania
      const initialMap: Record<string, string> = {};
      uniqueCatsArr.forEach(bankCat => {
        const lowerCat = bankCat.toLowerCase();
        let match = categories.find(c => lowerCat.includes(c.name.toLowerCase()));
        
        if (!match) {
           if (lowerCat.includes("jedzenie") || lowerCat.includes("restaurac") || lowerCat.includes("kawiarn")) {
              match = categories.find(c => c.name.toLowerCase().includes("restauracje"));
           } else if (lowerCat.includes("zakupy") || lowerCat.includes("market") || lowerCat.includes("spożyw")) {
              match = categories.find(c => c.name.toLowerCase().includes("zakupy") || c.name.toLowerCase().includes("jedzenie"));
           } else if (lowerCat.includes("elektronika") || lowerCat.includes("rtv") || lowerCat.includes("agd")) {
              match = categories.find(c => c.name.toLowerCase().includes("elektronika"));
           } else if (lowerCat.includes("sport") || lowerCat.includes("fitness") || lowerCat.includes("karnet") || lowerCat.includes("basen")) {
              match = categories.find(c => c.name.toLowerCase().includes("sport"));
           } else if (lowerCat.includes("zdrowie") || lowerCat.includes("apteka") || lowerCat.includes("leki") || lowerCat.includes("lekarz")) {
              match = categories.find(c => c.name.toLowerCase().includes("zdrowie"));
           } else if (lowerCat.includes("transport") || lowerCat.includes("paliwo") || lowerCat.includes("orlen") || lowerCat.includes("bilet") || lowerCat.includes("auto")) {
              match = categories.find(c => c.name.toLowerCase().includes("transport"));
           } else if (lowerCat.includes("dom") || lowerCat.includes("rachunki") || lowerCat.includes("prąd") || lowerCat.includes("czynsz")) {
              match = categories.find(c => c.name.toLowerCase().includes("rachunki") || c.name.toLowerCase().includes("dom"));
           }
        }

        if (match) {
          initialMap[bankCat] = match.id.toString();
        }
      });
      setCategoryMap(initialMap);

      setStep(3);
    } else {
      handleImport(); // Skip step 3 if no category column selected
    }
  };

  const handleImport = async () => {
    if (!accountId || !dateColumn || !amountColumn || !descColumn) return;
    
    setIsImporting(true);
    
    const payloads = csvData.map((row) => {
      const amountStr = row[amountColumn] as string;
      const parsedAmount = parseAmount(amountStr);
      const isIncome = parsedAmount > 0;
      const absAmount = Math.abs(parsedAmount);
      
      const rawDesc = (row[descColumn] as string) || "Brak tytułu";
      const desc = rawDesc.trim();
      
      let catId: number | undefined = undefined;
      
      if (catColumn && row[catColumn]) {
         const bankCat = row[catColumn].trim();
         const mappedCatId = categoryMap[bankCat];
         if (mappedCatId) catId = parseInt(mappedCatId);
      }
      
      // Fallback do historyLookup jeśli nie zmapowano z banku
      if (!catId) {
        catId = categoryLookup.get(desc.toLowerCase());
      }

      return {
        account_id: parseInt(accountId),
        category_id: catId || undefined,
        amount: absAmount,
        type: isIncome ? "income" : "expense",
        description: desc || null,
        date: parseDate(row[dateColumn] as string),
        transfer_to_id: undefined,
        tags: []
      };
    }).filter(p => p.amount > 0); // Ignore exactly 0.00 entries

    try {
      await bulkAddMutation.mutateAsync(payloads as any);
      setImportResult({ success: payloads.length, total: csvData.length });
    } catch (e) {
      console.error(e);
      alert("Błąd podczas importowania.");
    } finally {
      setIsImporting(false);
    }
  };

  if (importResult) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-3xl mx-auto text-center mt-20">
        <div className="w-24 h-24 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={48} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Import Zakończony Sukcesem!</h1>
        <p className="text-xl text-muted-foreground mt-4">
          Dodano <strong>{importResult.success}</strong> z {importResult.total} transakcji.
          <br/>
          Zastosowano automatyczną kategoryzację na podstawie Twojej historii.
        </p>
        <button
          onClick={() => navigate("/transactions")}
          className="mt-8 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          Przejdź do Historii
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Import CSV z Banku</h1>
        <p className="text-muted-foreground">Wgraj wyciąg bankowy, wskaż odpowiednie kolumny, a my zaimportujemy wszystkie transakcje.</p>
      </div>

      {step === 1 && !file ? (
        <div 
          className={`border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-300 flex flex-col items-center justify-center min-h-[400px] cursor-pointer
            ${isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
            <FileUp size={40} />
          </div>
          <h3 className="text-2xl font-bold mb-2">Przeciągnij i upuść plik CSV</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            lub kliknij, aby wybrać plik z komputera. Aplikacja automatycznie dopasuje waluty, usunie zbędne znaki i spróbuje przypisać kategorie.
          </p>
        </div>
      ) : step === 2 ? (
        <div className="space-y-8">
          <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border/50">
              <Settings className="text-primary" size={24} />
              <h2 className="text-xl font-bold">Zmapuj Kolumny</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-foreground">Konto Docelowe</label>
                <select 
                  className="bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                  value={accountId} onChange={e => setAccountId(e.target.value)}
                >
                  <option value="">Wybierz konto...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.balance.toFixed(2)} PLN)</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-foreground">Data</label>
                <select 
                  className="bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                  value={dateColumn} onChange={e => setDateColumn(e.target.value)}
                >
                  <option value="">Wybierz...</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-foreground">Kwota</label>
                <select 
                  className="bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                  value={amountColumn} onChange={e => setAmountColumn(e.target.value)}
                >
                  <option value="">Wybierz...</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-foreground">Tytuł</label>
                <select 
                  className="bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                  value={descColumn} onChange={e => setDescColumn(e.target.value)}
                >
                  <option value="">Wybierz...</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-foreground">Kategoria</label>
                <select 
                  className="bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                  value={catColumn} onChange={e => setCatColumn(e.target.value)}
                >
                  <option value="">Brak kolumny</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </div>

          {csvData.length > 0 && headers.length > 0 && (
            <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm overflow-hidden">
              <h3 className="text-lg font-bold mb-4">Podgląd pierwszych wpisów</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                    <tr>
                      {headers.map(h => (
                        <th key={h} className={`px-4 py-3 font-medium whitespace-nowrap
                          ${h === dateColumn ? 'bg-primary/10 text-primary' : ''}
                          ${h === amountColumn ? 'bg-primary/10 text-primary' : ''}
                          ${h === descColumn ? 'bg-primary/10 text-primary' : ''}
                          ${h === catColumn ? 'bg-primary/10 text-primary' : ''}
                        `}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {csvData.slice(0, 3).map((row, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        {headers.map(h => (
                          <td key={h} className="px-4 py-3 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={row[h]}>
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center bg-muted/30 p-6 rounded-2xl border border-border/50">
            <div>
              <p className="font-bold text-lg">Gotowe do importu: {csvData.length} transakcji</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertTriangle size={14} className="text-amber-500" />
                Upewnij się, że mapowanie jest poprawne. Operacji nie da się cofnąć masowo.
              </p>
            </div>
            <button
              onClick={handlePrepareCategories}
              disabled={isImporting || !accountId || !dateColumn || !amountColumn || !descColumn}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              Dalej <ArrowRight size={20} />
            </button>
          </div>
        </div>
      ) : step === 3 ? (
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-6">Zmapuj Kategorie Bankowe</h2>
            <p className="text-sm text-muted-foreground mb-6">Poniżej znajdują się wszystkie unikalne kategorie wykryte w Twoim wyciągu. Przypisz je do swoich kategorii z Domowego Budżetu, aby zachować porządek od razu podczas importu.</p>
            
            <div className="space-y-4">
              {uniqueBankCategories.map(bankCat => (
                <div key={bankCat} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-border rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="font-medium text-foreground">{bankCat}</div>
                  <select 
                    className="w-full sm:w-64 bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={categoryMap[bankCat] || ""}
                    onChange={e => setCategoryMap(prev => ({ ...prev, [bankCat]: e.target.value }))}
                  >
                    <option value="" className="bg-background text-foreground">Automatycznie / Inne</option>
                    {categories.map(c => <option key={c.id} value={c.id} className="bg-background text-foreground">{c.name}</option>)}
                  </select>
                </div>
              ))}
              {uniqueBankCategories.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Nie wykryto żadnych kategorii bankowych w pliku.</p>
              )}
            </div>
          </div>
          
          <div className="flex justify-between items-center bg-muted/30 p-6 rounded-2xl border border-border/50">
            <button
              onClick={() => setStep(2)}
              disabled={isImporting}
              className="px-6 py-3 rounded-xl font-bold hover:bg-muted transition-colors"
            >
              Wróć
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {isImporting ? "Importowanie..." : "Zatwierdź i Importuj"}
              {!isImporting && <CheckCircle size={20} />}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
