### PODSUMOWANIE WYKONAWCZE
**Ocena ogólna: 8.5/10**
Architektura aplikacji jest wyjątkowo solidna, z bardzo spójnym podziałem warstw (Tauri commands ↔ TanStack Query) oraz wzorową atomowością transakcji finansowych, jednak wymaga pilnego załatania problemu N+1 Queries przy tagach oraz dodania indeksów do bazy SQLite dla zachowania płynności przy wieloletnim korzystaniu.

---

### KRYTYCZNE BŁĘDY (🔴 blokujące)

**1. Problem N+1 Queries podczas pobierania transakcji**
- **Lokalizacja:** `src-tauri/src/db/transactions.rs` (linia ~104)
- **Opis:** Funkcja `get_transactions` iteruje po wszystkich transakcjach i dla **każdej z nich** wykonuje osobne zapytanie SQL `tags::get_tags_for_transaction`. Dla 5000 transakcji aplikacja wykonuje 5001 zapytań SQL. Zablokuje to aplikację i wyczerpie wątki przy większej bazie.
- **Naprawa:** Należy wykonać jedno zapytanie wyciągające wszystkie powiązania `SELECT transaction_id, tag_id FROM transaction_tags` i zmapować je w pamięci Rusta do HashMapy `HashMap<i64, Vec<Tag>>`, a następnie przypisać do transakcji bez dodatkowych zapytań do bazy.

**2. Testy Rust omijają oficjalny system migracji**
- **Lokalizacja:** `src-tauri/src/db/accounts.rs` (linia ~69)
- **Opis:** Funkcja `setup_in_memory_db` uruchamia `conn.execute_batch(include_str!("schema.sql"))`. Oznacza to, że testy weryfikują archaiczny model V1, omijając dodane później migracje w `migrations.rs` (np. tabele tagów). Skutkuje to niemożnością poprawnego testowania operacji na tagach.
- **Naprawa:** 
```rust
fn setup_in_memory_db() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    crate::db::migrations::run_migrations(&mut conn).unwrap(); // Zamiast sztywnego schema.sql
    conn
}
```

**3. Brak indeksów dla kluczy obcych w SQLite**
- **Lokalizacja:** `src-tauri/src/db/schema.sql`
- **Opis:** Relacyjne tabele (np. `transactions`) mają klucze obce `category_id` oraz `account_id`. W przeciwieństwie do PostgreSQL, SQLite **nie tworzy** domyślnie indeksów na kluczach obcych. Skutkuje to pełnym skanowaniem tabeli (Full Table Scan) przy każdym filtrowaniu po koncie lub kategorii.
- **Naprawa:** Należy wydać nową migrację (V3) z dodanymi indeksami:
```sql
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
```

---

### OSTRZEŻENIA (🟡 ważne)

**1. Podwójne ujmowanie kwot przy transakcjach (Validation)**
- **Lokalizacja:** `src-tauri/src/db/transactions.rs`
- **Opis:** W komendzie wprowadzania transakcji odejmujemy saldo z bazy: `balance = balance - ?1` gdzie `?1` to kwota. Nie ma weryfikacji w Ruscie chroniącej przed przesłaniem ujemnej wartości przez front. Przesłanie ujemnego wydatku złośliwie dodałoby pieniądze do konta. Należy rzucić błąd z poziomu API jeśli `amount <= 0`.

**2. Brak Virtualizacji przy długich listach**
- **Lokalizacja:** Interfejs UI z listą Historii
- **Opis:** Choć paginacja / limity mogą być zaimplementowane w SQLite, to obecnie frontend renderuje wszystkie transakcje naraz w tabeli. Warto rozważyć bibliotekę `@tanstack/react-virtual` dla głównej tabeli Historii.

**3. Blokowanie głównego wątku przez PapaParse**
- **Lokalizacja:** `src/pages/Import.tsx`
- **Opis:** Import CSV zrzuca całą obsługę parsowania do pamięci RAM przeglądarki. Pliki z banków zazwyczaj są małe, jednak przy potencjalnie wielkich paczkach mogłoby to na chwilę zamrozić UI.

---

### SUGESTIE (🟢 poprawki jakości)

1. **Strict TypeScript:** Pomimo ogólnie dobrego typowania, w `Import.tsx` pozostawiono stan jako `useState<any[]>([])`. Warto dorobić generyczny typ dla rowów np. `Record<string, string>`.
2. **Optymalizacja importów Lucide:** Ikony są wciągane przez `import { Wallet, ... } from "lucide-react";`. Vite radzi sobie z Tree-Shakingiem, ale z doświadczenia w aplikacjach desktopowych lepiej importować je selektywnie lub upewnić się, że paczkarka skutecznie ucina resztę ikon.
3. **Konsekwencja Inwalidacji:** W `queries.ts`, `useAddTransaction` strzela bardzo szeroką serią `invalidateQueries` (konta, transakcje, budżety, tagi). Można by zoptymalizować to do odświeżania jedynie kluczy faktycznie zmienionych (np. nie odświeżać budżetów, jeśli dodano transfer).

---

### DOBRE PRAKTYKI (✅ pochwal)

✅ **Absolutnie genialna logika ZBB (Zero-Based Budgeting)**
W module `useReadyToAssign.ts` algorytm przenoszenia sald do następnego miesiąca prawidłowo używa konstrukcji `Math.max(states[prevMonth][cat.id].available, 0)`. Oznacza to, że wyłapaliście największą zmorę narzędzi budżetowych – ujemny debet kategorii *nie przechodzi* na kolejny miesiąc, tylko poprawnie obciąża całkowity wskaźnik RTA ("Ready to Assign"). Dokładnie tak robi to kultowy program *YNAB*.

✅ **Bezpieczeństwo SQL Injection**
Programiści warstwy Rust odrobili zadanie domowe, stosując makro `params![payload.amount...]` zamiast formatowania stringów we wszystkich `conn.execute()`. Aplikacja jest całkowicie odporna na wstrzyknięcia zapytań SQL.

✅ **Atomowość Transakcji Bankowych**
Transfery i cykliczne wpłaty stosują kod ujęty w `conn.transaction()?`. Dzięki temu nie istnieje scenariusz "dangling funds", w którym po restarcie komputera w ułamku sekundy proces zabrałby pieniądze z jednego konta, a nie przypisał do drugiego (transakcja nie ulega commitowi w bazie dopóki wszystkie zapytania `UPDATE` nie zwrócą sukcesu).

---

### PRIORYTETY NAPRAWY (Top 5)

1. **🔴 Przebudowa pobierania Tagów w Rust (likwidacja pętli zapytań N+1).**
2. **🔴 Dodanie indeksów FK na tabeli `transactions` jako kolejna migracja SQLite.**
3. **🔴 Zmiana pliku konfiguracyjnego `tests` w Ruscie, aby używał `run_migrations()` zamiast sztywnego `schema.sql`.**
4. **🟡 Dodanie walidacji backendowej blokującej kwoty `<= 0` na poziomie Tauri Commanda.**
5. **🟢 Aktualizacja interfejsu tabel / wdrożenie `react-virtual` dla płynnego przewijania 10 tysięcy rekordów Historii.**