# Audyt aplikacji „Domowy Budżet"

Data: 2026-08-07 · Wersja wyjściowa: 2.0.3 → **2.1.0** · Zakres: frontend (React/TS) + backend (Rust/SQLite)

Audyt objął cały kod źródłowy (~6 800 linii), wszystkie moduły funkcjonalne oraz konfigurację
projektu. Poniżej pełna lista znalezionych problemów wraz z wprowadzonymi poprawkami.

**Stan po audycie:** `cargo test` — 27 testów, wszystkie zielone (przed audytem: 2).
`cargo clippy --all-targets` — bez ostrzeżeń. `npm run build` — bez błędów i ostrzeżeń TypeScript.

---

## 1. Błędy krytyczne

### 1.1 Potwierdzenie ujemnego salda nigdy nie zapisywało operacji

**Gdzie:** `src/components/ui/Modal.tsx`, `GlobalTransactionModal.tsx`, `Goals.tsx`

`Modal` wykrywał kliknięcie „poza oknem" globalnym nasłuchem `mousedown` na `document`
(hook `useClickOutside`). Aplikacja świadomie nakłada okna: formularz transakcji → ostrzeżenie
o debecie. Kliknięcie przycisku **„Kontynuuj"** w oknie wierzchnim było dla okna spodniego
kliknięciem „na zewnątrz", więc zamykało formularz transakcji. `GlobalTransactionModal` zwraca
`null`, gdy formularz jest zamknięty — a zwraca też ostrzeżenie o debecie. Przycisk znikał
z DOM między `mousedown` a `click`, więc `onClick` nigdy nie wystrzelił.

**Skutek:** każda transakcja przekraczająca saldo konta była po cichu porzucana.

**Poprawka:** wykrywanie kliknięcia przeniesione na sam element tła (`e.target === e.currentTarget`),
co jest odporne na zagnieżdżanie. Dodano stos modali — `Escape` zamyka wyłącznie okno wierzchnie.
Okna wymagające świadomej decyzji dostały `closeOnBackdropClick={false}`.

### 1.2 Przelew bez konta docelowego znikał z bilansu

**Gdzie:** `src-tauri/src/db/transactions.rs`

Walidacja sprawdzała tylko kwotę i typ. Dla `type = "transfer"` aktualizacja sald działała
wewnątrz `if let Some(transfer_to)` — przy `transfer_to_id = NULL` transakcja **zapisywała się
do bazy, ale nie ruszała żadnego salda**. Historia i salda kont rozjeżdżały się trwale, bez
żadnego komunikatu. Przelew na to samo konto był akceptowany jako pusta operacja.

**Poprawka:** wspólna funkcja `validate_transaction` (używana przez `create`, `update`
i `bulk_insert`) odrzuca przelew bez konta docelowego, przelew na to samo konto oraz kwoty
`NaN`/`Infinity`. Poprzednio walidacja była skopiowana w trzech miejscach i już się rozjeżdżała.

### 1.3 Import kopii zapasowej mógł bezpowrotnie skasować dane

**Gdzie:** `src-tauri/src/lib.rs`

`import_db` kasowało bieżący plik bazy **zanim** sprawdziło, czy plik źródłowy jest w ogóle
bazą SQLite. Gdy `fs::copy` zawiodło (zły plik, brak uprawnień, blokada AV), połączenie zostawało
na pustej bazie w RAM, a plik użytkownika był już usunięty. Dodatkowo na wgranej bazie **nie
uruchamiano migracji** — przywrócenie backupu ze starszej wersji zostawiało nieaktualny schemat
i aplikacja wywalała się na brakujących kolumnach.

**Poprawka:** walidacja pliku źródłowego przed jakąkolwiek destrukcyjną operacją (czy to SQLite
i czy zawiera tabele tej aplikacji), kopia rollback bieżącej bazy z automatycznym przywróceniem
na każdej ścieżce błędu, oraz `run_migrations` + `configure_connection` na wgranym pliku.

### 1.4 Edycja subskrypcji bez ustawionego dnia rozliczenia wywalała aplikację

**Gdzie:** `src/pages/Subscriptions.tsx`

`rec.day_of_month.toString()` — kolumna jest w bazie `NULLABLE` (i `Option<i32>` w Rust).
Kliknięcie „edytuj" na takim rekordzie rzucało `TypeError` i wywracało widok.

**Poprawka:** sprawdzenie `!= null` z sensownym fallbackiem; typ TS poprawiony na
`number | null`, żeby kompilator wyłapał kolejne takie miejsca.

---

## 2. Błędy logiki biznesowej

### 2.1 Pole `frequency` subskrypcji było całkowicie ignorowane

`process_due_recurrings` zawsze przesuwał datę o jeden miesiąc, niezależnie od zapisanej
częstotliwości. Formularz nie miał nawet pola wyboru, a karta subskrypcji miała zaszyty na
sztywno napis „Co miesiąc". Kolumna istniała w schemacie od początku i była zapisywana.

**Poprawka:** funkcja `advance_date` obsługuje `weekly` / `monthly` / `quarterly` / `yearly`,
w formularzu dodano wybór częstotliwości, a karta pokazuje faktyczną wartość z bazy.

### 2.2 Dzień rozliczenia w krótszych miesiącach

Przy nieudanej konstrukcji daty (np. 31 lutego) kod wpisywał **na sztywno 28.** — subskrypcja
z dniem 30 przeskakiwała na 28 i tam zostawała. Teraz kwota jest przycinana do ostatniego dnia
docelowego miesiąca (31 stycznia → 29 lutego w roku przestępnym → 31 marca).

### 2.3 Licznik nadrobionych płatności gubił operacje

`processed_count += 1` stało **za** instrukcją `break` obsługującą błąd parsowania daty.
Transakcja była już zaksięgowana, ale nie trafiała do licznika pokazywanego użytkownikowi.
Dodatkowo pętla nadrabiania zaległości nie miała żadnego ogranicznika — uszkodzony rekord
mógł ją zapętlić przy starcie aplikacji. Dodano limit 520 iteracji.

### 2.4 Ujemne kwoty tam, gdzie nie mają sensu

- **Wpłata na cel** (`add_to_goal`): brak walidacji. Ujemna kwota **dodawała** pieniądze
  do konta i zmniejszała postęp celu.
- **Budżet** (`upsert_budget`): ujemny przydział znikał z „Do Rozdysponowania" bez śladu,
  bo carry-over sumuje wyłącznie wartości dodatnie.
- **Cel** (`create_goal` / `update_goal`): brak walidacji kwoty docelowej i zgromadzonej.

Wszystkie te ścieżki mają teraz walidację po stronie Rusta **oraz** czytelny komunikat w UI.

### 2.5 Miesiąc budżetu bez walidacji formatu

Cały silnik ZBB porównuje i sortuje miesiące leksykalnie (`"2024-01" < "2024-02"`). Dowolny
inny format wstawiony do kolumny `month` cicho psuł kolejność, a więc i carry-over.
Dodano walidację `RRRR-MM` w `upsert_budget` i `copy_budgets_to_month`.

### 2.6 Kopiowanie budżetów nie było atomowe

`copy_budgets_to_month` wykonywało osobny `upsert` na każdą kategorię. Błąd w połowie zostawiał
użytkownika z częściowo przepisanym planem. Zastąpione jednym `INSERT ... SELECT` w transakcji.

### 2.7 Zwrot środków przy usuwaniu transakcji powiązanej z celem

`delete_transaction` odejmowało kwotę od celu niezależnie od typu transakcji. Wpłata na cel jest
zawsze wydatkiem — dla innych typów była to korekta bez pokrycia. Dodano sprawdzenie typu.

### 2.8 Przelewy prezentowane jako przychody

W historii transakcji przelew wpadał do gałęzi „nie-wydatek", więc renderował się jako **zielony
przychód ze znakiem `+`**. Eksport CSV zapisywał go jako „Przychód" z kwotą dodatnią, co zawyżało
sumy po wczytaniu do arkusza. Podgląd konta pokazywał przelewy wychodzące jako przychód.
Wszystkie trzy miejsca rozróżniają teraz trzeci typ (kolor niebieski, etykieta „Przelew",
w podglądzie konta kierunek liczony względem oglądanego konta).

### 2.9 Wskaźnik „Zaksięgowano" dla subskrypcji

Porównanie `next_date.substring(0,7) > currentMonth` działało tylko dla częstotliwości
miesięcznej. Zastąpione porównaniem pełnej daty z dniem dzisiejszym (Dashboard + lista).

---

## 3. React Query — nieaktualne dane i wyścigi

### 3.1 Wykresy nie odświeżały się nigdy

Dashboard i Raporty miały **własne, niezależne** klucze zapytań
(`dashboardChartTransactions`, `reportTransactions`), których nie unieważniała żadna mutacja.
Po dodaniu transakcji wykresy pokazywały stan sprzed zmiany aż do restartu aplikacji.
Do tego oba pobierały ten sam pełny zbiór danych osobno.

**Poprawka:** wprowadzono `queryKeys` — jedno miejsce z definicjami kluczy. Wszystkie zapytania
o transakcje zaczynają się od `["transactions"]`, więc pojedyncze unieważnienie prefiksu
odświeża listę, wykresy, podgląd konta i import naraz. Dashboard i Raporty współdzielą
`useAllTransactions`.

### 3.2 `dashboardStats` i lista miesięcy nie były unieważniane przez nic

Każda z siedmiu mutacji miała własną, ręcznie utrzymywaną listę kluczy do unieważnienia
i **każda** pomijała te dwa. Kafelki „Wydatki/Przychody w tym miesiącu" oraz filtr miesięcy
pokazywały nieaktualne wartości.

**Poprawka:** jedna funkcja `invalidateAfterTransactionChange` używana przez wszystkie mutacje
dotykające transakcji. Zlikwidowano rozjeżdżanie się list.

### 3.3 Zduplikowany `useEffect` i wyścig w podglądzie konta

`Accounts.tsx` zawierał **dwa identyczne** bloki `useEffect` pobierające te same dane —
każde otwarcie podglądu strzelało dwa razy. Ręczny `api.getTransactions().then(setState)`
nie anulował się przy szybkiej zmianie konta, więc odpowiedź dla poprzedniego konta mogła
nadpisać aktualną. Zastąpione hookiem `useAccountTransactions` (React Query).

### 3.4 Wyszukiwarka odpytywała bazę na każdy znak

Brak debounce — każde naciśnięcie klawisza tworzyło nowe zapytanie SQL i nowy wpis w cache,
a lista mrugała komunikatem „Brak pasujących transakcji". Dodano debounce 250 ms
i `placeholderData: keepPreviousData`.

### 3.5 Ekran powitalny migał przy każdym starcie

`accounts.length === 0 ? <Onboarding/> : <Dashboard/>` — podczas ładowania `accounts` jest
pustą tablicą, więc każdy istniejący użytkownik widział przez moment ekran „Twoja baza jest
pusta". Dodano obsługę stanu ładowania.

---

## 4. Obsługa błędów

| Miejsce | Problem | Poprawka |
|---|---|---|
| `GlobalTransactionModal` | Błąd zapisu trafiał tylko do `console.error` — formularz sprawiał wrażenie zawieszonego | Komunikat z backendu w oknie dialogowym |
| `Goals` (wpłata) | Jak wyżej | Jak wyżej |
| `Subscriptions` | Generyczne „Nie udało się zapisać" zamiast konkretnej przyczyny | Treść błędu z backendu |
| `Settings` (import) | „Nie udało się wgrać pliku" niezależnie od przyczyny | Backend rozróżnia teraz: nie-SQLite / nie-nasza-kopia / błąd kopiowania |
| `Import` | `alert()` zamiast systemu dialogów aplikacji | `showAlert` |
| `Budgets` | Odrzucony zapis budżetu bez informacji, pole zostawało z błędną wartością | Komunikat + przywrócenie poprzedniej wartości |
| `get_dashboard_stats` | `if let Ok(...)` po cichu gubiło wiersze → zaniżone sumy | Błąd propagowany |
| `bulk_insert_transactions` | Jak wyżej, przy budowaniu zbioru duplikatów → import mógł wstawić duplikat | Błąd propagowany |
| `calculate_zbb_states` | Jak wyżej, w dwóch pętlach silnika ZBB → pominięty przydział lub wydatek zaniżał budżet bez żadnego sygnału | Błąd propagowany |

Wzorzec `if let Ok(...) = row` w pętli po wynikach zapytania okazał się powtarzalnym problemem —
występował w czterech miejscach i wszędzie zamieniał błąd bazy w cichy, błędny wynik finansowy.
Wszystkie wystąpienia zostały usunięte; `cargo clippy` przechodzi bez ostrzeżeń.

---

## 5. Baza danych

### 5.1 Tryb dziennika

Baza działała w domyślnym trybie `journal_mode = delete`. `export_db` wykonywał
`PRAGMA wal_checkpoint(TRUNCATE)`, co w tym trybie **nic nie robi** — eksport mógł pominąć
najświeższe zapisy. Włączono WAL (`configure_connection`), przez co checkpoint przed kopiowaniem
faktycznie działa. Dodano test pilnujący tej konfiguracji.

### 5.2 Brakujące indeksy (migracja V6)

Kolumna `date` była filtrowana i grupowana praktycznie wszędzie (silnik ZBB, Dashboard, historia,
wykrywanie subskrypcji) i **nie miała indeksu**. Dodano:
`transactions(date)`, `transactions(type)`, `transactions(transfer_to_id)`, `transactions(goal_id)`,
`budgets(month)`, `recurring(next_date, active)`.

### 5.3 Ignorowane sugestie subskrypcji (migracja V7)

Lista ukrytych sugestii trzymana była jako **jeden string rozdzielany przecinkami** w
`app_settings`. Opisy z wyciągów bankowych regularnie zawierają przecinki, więc wpis rozpadał się
na fragmenty i ukryta sugestia wracała przy każdym odświeżeniu. Przeniesiono do własnej tabeli
`ignored_subscriptions`; migracja rozbija starą wartość rekurencyjnym CTE, zachowując
dotychczasowe zachowanie dla opisów bez przecinków.

### 5.4 Reset fabryczny

- Kasował PIN i tryb prywatności, choć okno potwierdzenia obiecuje wyłącznie usunięcie danych
  finansowych. Ustawienia bezpieczeństwa są teraz zachowywane.
- Nie zerował sekwencji `AUTOINCREMENT` — po resecie ID startowały od poprzednich wartości.
- Nie czyścił ignorowanych sugestii subskrypcji.
- Logika przeniesiona z warstwy komend do `db::factory_reset` i pokryta testami (w tym przypadek
  bazy, w której `sqlite_sequence` jeszcze nie istnieje).

### 5.5 Tagi z przecinkiem w nazwie

Tagi sklejane były przez `GROUP_CONCAT(tg.name, ',')` i rozbijane po przecinku przy odczycie.
Tag „Warszawa, Centrum" wracał z bazy jako dwa osobne tagi. Zmieniono separator na znak
US (`char(31)`), którego nie da się wpisać z klawiatury. Pokryte testem round-trip.

### 5.6 Tagi nigdy nie były sprzątane

Usunięcie transakcji kasowało powiązanie, ale sam tag zostawał w tabeli `tags` na zawsze —
lista podpowiedzi w modalu transakcji rosła w nieskończoność o nazwy nieużywane od miesięcy.
Dodano `prune_orphan_tags` wywoływane przy usuwaniu i edycji transakcji oraz usuwaniu konta.

### 5.7 Klucze obce — ustalenie faktów

**Wstępna hipoteza okazała się błędna i warto to odnotować.** Schemat deklaruje
`ON DELETE CASCADE` / `ON DELETE SET NULL`, a nigdzie w kodzie nie było `PRAGMA foreign_keys = ON`,
co sugerowało, że klauzule te są martwe (SQLite domyślnie wyłącza klucze obce).

Weryfikacja empiryczna wykazała, że **rusqlite włącza `foreign_keys = ON` samodzielnie** —
integralność referencyjna działała przez cały czas. Kilka poprawek napisanych pod tę hipotezę
(jawne czyszczenie `goal_id` w `delete_goal`, jawne kasowanie `transaction_tags` przy usuwaniu
konta) zostało zachowanych jako zabezpieczenie, ale **nie były to naprawy realnych błędów** —
komentarze w kodzie zostały odpowiednio poprawione.

`PRAGMA foreign_keys = ON` ustawiamy teraz jawnie, żeby integralność nie zależała od domyślnych
ustawień biblioteki zewnętrznej i obowiązywała także dla baz wgranych przez import.
Sprzątanie sierot w migracji V6 zachowano jako zabezpieczenie właśnie dla tej ścieżki — jest
idempotentne i na zdrowej bazie nic nie zmienia. Oba scenariusze pokryte testami.

---

## 6. Testy funkcjonalne modułów

Logikę obliczeniową pokryto testami jednostkowymi w Rust (in-memory SQLite). Stan: **27 testów**.

| Moduł | Sprawdzone przypadki | Wynik |
|---|---|---|
| **Budżety ZBB** | Carry-over nadwyżki na kolejny miesiąc | ✅ poprawne |
| | Debet **nie** przechodzi dalej, ale jest raportowany jako `overspent` | ✅ poprawne |
| | Zwrot (przychód na kategorii wydatkowej) pomniejsza aktywność | ✅ poprawne |
| | „Do Rozdysponowania" = gotówka − przypisane środki | ✅ poprawne |
| | Pusta baza → same zera, brak dzielenia przez zero | ✅ poprawne |
| **Transakcje** | Kwota 0, ujemna, `NaN` | ❌ → naprawione |
| | Przelew bez konta docelowego / na to samo konto | ❌ → naprawione |
| | Odrzucona transakcja nie rusza salda (rollback) | ✅ poprawne |
| | Tagi z przecinkiem w nazwie | ❌ → naprawione |
| | Usunięcie transakcji przywraca saldo i sprząta tagi | ❌ → naprawione |
| | Import masowy pomija duplikaty | ✅ poprawne |
| **Konta** | Usunięcie konta będącego celem przelewu zwraca środki nadawcy | ✅ poprawne |
| | Brak osieroconych powiązań z tagami po usunięciu konta | ✅ poprawne |
| **Subskrypcje** | Częstotliwość tygodniowa/miesięczna/kwartalna/roczna | ❌ → naprawione |
| | Dzień 31 w lutym (rok przestępny i zwykły) | ❌ → naprawione |
| | Przełom roku | ✅ poprawne |
| | Data zawsze idzie do przodu (ochrona przed zapętleniem) | ❌ → naprawione |
| **Migracje** | Czysta baza, idempotencja | ✅ poprawne |
| | Aktualizacja z V5 nie gubi danych | ✅ poprawne |
| | Sprzątanie wiszących referencji z importu | ✅ poprawne |
| | Migracja ignorowanych sugestii z `app_settings` | ✅ poprawne |
| **Reset / konfiguracja** | Reset czyści dane, zachowuje PIN, zeruje sekwencje | ❌ → naprawione |
| | Reset na bazie bez `sqlite_sequence` | ✅ poprawne |
| | Połączenie w trybie WAL z kluczami obcymi | ❌ → naprawione |

Moduły **Import/Eksport CSV**, **PIN/Prywatność** i warstwa prezentacji zweryfikowane przeglądem
kodu i kompilacją — opisane w sekcjach 1–4 i 7.

---

## 7. Bezpieczeństwo i prywatność

- **PIN** nie miał pola potwierdzenia i przyjmował znaki inne niż cyfry — ekran blokady ma
  wyłącznie klawiaturę numeryczną, więc taki PIN był **nie do wpisania** i trwale odcinał dostęp
  do aplikacji. Dodano powtórzenie PIN-u i filtrowanie do cyfr (4–6 znaków).
- `removePin` nie ustawiało `isUnlocked`, a `factoryReset` nie odświeżało stanu autoryzacji —
  interfejs pokazywał „Wyłącz PIN" mimo braku PIN-u. Naprawione.
- **Google Fonts z CDN**: `index.html` ładował arkusz z `fonts.googleapis.com`, ale własna
  polityka CSP aplikacji (`style-src 'self'`) go blokowała. Czcionki i tak nigdy się nie wczytywały,
  a aplikacja reklamowana jako w 100% lokalna przy każdym starcie próbowała wyjść do sieci.
  Odnośniki usunięte, wprowadzono pełny systemowy stos czcionek.
- Blokada po 5 nieudanych próbach PIN-u nie przeżywa restartu aplikacji — **znane ograniczenie**,
  nienaprawione (patrz sekcja 10).

---

## 8. Porządki w projekcie

### Usunięte pliki

| Plik | Powód |
|---|---|
| `src/hooks/useFocusTrap.ts` | Nigdy nieużywany, mimo że README i CHANGELOG ogłaszały „Focus Trap w globalnych modalach" |
| `src/hooks/useReadyToAssign.ts` | Jednolinijkowa nakładka na `useReadyToAssignData` |
| `src/App.css` | Pusty, nigdzie nieimportowany |
| `src/assets/react.svg` | Pozostałość po szablonie Vite |
| `public/tauri.svg` | Jak wyżej |

### Usunięty martwy kod

- `get_transactions_count` (komenda + funkcja DB + metoda API) — bez ani jednego wywołania,
  a przy okazji **ignorowała filtr konta**, więc jej wyniki i tak byłyby błędne.
- `get_budgets`, `get_all_budgets` (komendy + funkcje DB + metody API + struktura `Budget`
  i interfejs TS) — UI korzysta wyłącznie z `get_budget_states`.
- `tags::get_tags_for_transaction`, `tags::set_transaction_tags`, `settings::delete_setting`.
- Hooki `useBudgets`, `useAllBudgets`; interfejs `BackupData`.
- Rzutowanie `as any` przy imporcie masowym — ukrywało realny błąd typów
  (`description: string | null` wobec `string | undefined`), ujawniony po usunięciu.

### Zależności

| Paczka | Akcja |
|---|---|
| `serde_json` (Cargo) | Usunięta — zero użyć |
| `tauri-plugin-opener` (Cargo + npm + uprawnienia) | Usunięta — zero użyć |
| `react-router` / `react-router-dom` | Zaktualizowane — 2 podatności o wysokiej istotności |
| `postcss` | Zaktualizowany — 1 podatność o średniej istotności |
| `vite` 7 → 8, `@vitejs/plugin-react` 4 → 6 | Aktualizacja główna — usuwa podatność `esbuild` |

`npm audit`: **4 podatności → 0.**

Ostatnia luka (odczyt dowolnych plików przez serwer deweloperski na Windows) siedziała w `esbuild`
i nie dało się jej załatać w obrębie Vite 7. Vite 8 opiera się na **Rolldown/Oxc** i nie używa już
`esbuild` w ogóle, więc podatność znika wraz z zależnością. Wymagało to podniesienia
`@vitejs/plugin-react` do wersji 6 (peer `vite ^8`); `@tailwindcss/vite` wspiera Vite 8 bez zmian.
Zweryfikowano kompilację produkcyjną oraz start serwera deweloperskiego na porcie 1420
wymaganym przez Tauri. Przy okazji: build skrócił się z ~6,5 s do ~2 s, a bundle zmalał o ~15 kB.

### Ujednolicona struktura i nazewnictwo

- Wprowadzono `queryKeys` w `src/lib/queries.ts` — koniec z rozsypanymi literałami kluczy.
- Typy ładunków API (`TransactionInput`, `AccountInput`, `GoalInput`, `RecurringInput`)
  wyciągnięte z powtarzanych w kółko wyrażeń `Omit<...>`.
- `getBudgetStates` miało zwracany typ `any[]` → `BudgetState[]`.
- Dodano `RECURRING_FREQUENCIES` / `FREQUENCY_LABELS` jako jedno źródło prawdy dla
  częstotliwości, zsynchronizowane ze stałą `FREQUENCIES` w Rust.
- Logika resetu fabrycznego przeniesiona z `lib.rs` do `db::factory_reset` — warstwa komend
  Tauri jest teraz konsekwentnie cienka.
- Typy `any` w sygnaturach komponentów (`openEditModal(acc: any)`, `(rec: any)`, `(sug: any)`)
  zastąpione konkretnymi interfejsami.

---

## 9. Zmiany w schemacie bazy

Aktualna wersja schematu: **V7**. Migracje są kaskadowe i przetestowane pod kątem aktualizacji
z V5 — istniejące bazy użytkowników zostaną podniesione automatycznie przy pierwszym starcie.

- **V6** — indeksy zapytań + idempotentne sprzątanie wiszących referencji.
- **V7** — tabela `ignored_subscriptions` + przeniesienie danych z `app_settings`.

---

## 10. Znane ograniczenia (nienaprawione, świadomie)

1. **Rozmiar bundla ~868 kB** — jedna paczka JS, głównie `recharts`. Do rozważenia code-splitting
   tras (`React.lazy`) przy kolejnej optymalizacji.
2. **Blokada po nieudanych próbach PIN-u nie przeżywa restartu** — 30-sekundowa blokada jest
   trzymana w stanie komponentu. Utrwalenie wymagałoby zapisu znacznika w bazie.
3. **Modal transakcji nie pozwala wybrać daty** — nowe operacje dostają zawsze dzisiejszą datę
   (przy edycji data jest zachowywana). To istniejące ograniczenie funkcjonalne, nie błąd.
4. **`get_ready_to_assign` przelicza cały silnik ZBB przy każdym wywołaniu** — przy bardzo dużej
   historii może to być odczuwalne. Dodane indeksy znacząco to łagodzą; ewentualna memoizacja
   to temat na osobną iterację.
