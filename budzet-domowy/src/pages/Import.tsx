import { useState, useRef, useMemo } from "react";
import Papa from "papaparse";
import { useAccounts, useTransactions, useBulkAddTransactions } from "../lib/queries";
import { FileUp, CheckCircle, AlertTriangle, ArrowRight, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Import() {
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const bulkAddMutation = useBulkAddTransactions();

  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  const [accountId, setAccountId] = useState<string>("");
  const [dateColumn, setDateColumn] = useState<string>("");
  const [amountColumn, setAmountColumn] = useState<string>("");
  const [descColumn, setDescColumn] = useState<string>("");
  
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{success: number, total: number} | null>(null);

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
            
            if (dateGuess) setDateColumn(dateGuess);
            if (amountGuess) setAmountColumn(amountGuess);
            if (descGuess) setDescColumn(descGuess);
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
      const catId = categoryLookup.get(desc.toLowerCase());

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

      {!file ? (
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
      ) : (
        <div className="space-y-8">
          <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border/50">
              <Settings className="text-primary" size={24} />
              <h2 className="text-xl font-bold">Zmapuj Kolumny</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <label className="text-sm font-bold text-foreground">Kolumna z Datą</label>
                <select 
                  className="bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                  value={dateColumn} onChange={e => setDateColumn(e.target.value)}
                >
                  <option value="">Wybierz...</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-foreground">Kolumna z Kwotą</label>
                <select 
                  className="bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                  value={amountColumn} onChange={e => setAmountColumn(e.target.value)}
                >
                  <option value="">Wybierz...</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-foreground">Kolumna z Tytułem</label>
                <select 
                  className="bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/50"
                  value={descColumn} onChange={e => setDescColumn(e.target.value)}
                >
                  <option value="">Wybierz...</option>
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
              onClick={handleImport}
              disabled={isImporting || !accountId || !dateColumn || !amountColumn || !descColumn}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {isImporting ? "Importowanie..." : "Rozpocznij Import"}
              {!isImporting && <ArrowRight size={20} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
