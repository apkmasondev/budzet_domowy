# Changelog

Wszystkie znaczące zmiany w projekcie. Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/).

## [2.1.0] - 2026-08-07 — Audyt kodu i stabilizacja

Kompleksowy audyt frontendu i backendu. Pełny raport: [audit.md](audit.md).
Schemat bazy podniesiony do **V7** (migracja automatyczna przy pierwszym starcie).

### Naprawione — krytyczne

- **Potwierdzenie ujemnego salda nie zapisywało operacji.** Kliknięcie „Kontynuuj" w ostrzeżeniu
  o debecie zamykało formularz pod spodem, usuwając przycisk z DOM zanim zadziałało zdarzenie.
  Każdy wydatek przekraczający saldo konta był po cichu porzucany.
- **Przelew bez wskazanego konta docelowego** zapisywał się do bazy, nie ruszając żadnego salda —
  historia i salda kont rozjeżdżały się trwale. Odrzucany jest teraz również przelew na to samo konto.
- **Import kopii zapasowej mógł skasować dane bezpowrotnie** — bieżąca baza była usuwana przed
  weryfikacją pliku źródłowego. Dodano walidację pliku i automatyczne wycofanie zmian przy błędzie.
- **Import backupu ze starszej wersji nie uruchamiał migracji**, zostawiając nieaktualny schemat.
- **Edycja subskrypcji bez ustawionego dnia rozliczenia** wywalała widok (`null.toString()`).

### Naprawione — logika biznesowa

- Częstotliwość subskrypcji była ignorowana — wszystko księgowało się co miesiąc. Obsługiwane są
  teraz warianty tygodniowy, miesięczny, kwartalny i roczny (z wyborem w formularzu).
- Dzień rozliczenia w krótszym miesiącu przeskakiwał na sztywno na 28. Teraz przycinany jest do
  ostatniego dnia miesiąca (31 stycznia → 29 lutego → 31 marca).
- Licznik nadrobionych płatności gubił zaksięgowane operacje; pętla nadrabiania zaległości
  dostała ogranicznik chroniący przed zapętleniem przy starcie.
- Ujemne kwoty przyjmowane przy wpłacie na cel (co **dodawało** pieniądze do konta), przy
  budżetach (kwota znikała z „Do Rozdysponowania") i przy celach oszczędnościowych.
- Brak walidacji formatu miesiąca w budżetach — dowolny inny format cicho psuł carry-over ZBB.
- Kopiowanie budżetów między miesiącami nie było atomowe.
- Przelewy prezentowane jako zielone przychody w historii, w eksporcie CSV („Przychód" z kwotą
  dodatnią, co zawyżało sumy w arkuszu) i w podglądzie konta.
- Wskaźnik „Zaksięgowano" dla subskrypcji działał poprawnie tylko dla częstotliwości miesięcznej.
- Zwrot środków na cel przy usuwaniu transakcji wykonywał się niezależnie od jej typu.

### Naprawione — dane i odświeżanie widoków

- Wykresy na Dashboardzie i w Raportach **nie odświeżały się nigdy** — miały własne klucze cache,
  których nie unieważniała żadna mutacja. Dane były nieaktualne aż do restartu aplikacji.
- Kafelki „Wydatki/Przychody w tym miesiącu" oraz filtr miesięcy nie były unieważniane przez
  żadną mutację.
- Zduplikowany `useEffect` w widoku Kont wysyłał każde zapytanie dwa razy; ręczne pobieranie
  danych mogło nadpisać widok odpowiedzią dla poprzednio wybranego konta.
- Ekran powitalny migał przy każdym starcie u użytkowników mających już konta.
- Wyszukiwarka transakcji odpytywała bazę na każdy wciśnięty klawisz (dodano debounce)
  i mrugała komunikatem o braku wyników.
- Nieczytelny plik CSV zostawiał pustą stronę bez komunikatu i bez możliwości wyboru innego pliku.
- Podsumowanie importu pokazywało liczbę zaznaczonych wierszy zamiast faktycznie dodanych.

### Naprawione — obsługa błędów

- Błędy zapisu w modalu transakcji, przy wpłacie na cel i przy subskrypcjach trafiały wyłącznie
  do konsoli — formularz sprawiał wrażenie zawieszonego. Wszystkie pokazują teraz przyczynę.
- `get_dashboard_stats` i import masowy po cichu gubiły wiersze przy błędzie odczytu, zaniżając
  sumy i przepuszczając duplikaty.

### Naprawione — baza danych

- Włączono tryb **WAL**. Bez niego `wal_checkpoint` wykonywany przed eksportem nic nie robił,
  więc kopia zapasowa mogła pomijać najświeższe zapisy.
- Dodano brakujące indeksy, m.in. na `transactions(date)` — kolumnę filtrowaną i grupowaną
  praktycznie w każdym zapytaniu aplikacji (migracja V6).
- Ignorowane sugestie subskrypcji trzymane były jako jeden ciąg rozdzielany przecinkami; opisy
  bankowe zawierające przecinek powodowały, że ukryta sugestia wracała. Przeniesione do własnej
  tabeli (migracja V7).
- Tag zawierający przecinek w nazwie rozpadał się przy odczycie na dwa osobne tagi.
- Tagi nigdy nie były sprzątane — lista podpowiedzi rosła w nieskończoność.
- Reset fabryczny kasował PIN i tryb prywatności (mimo że okno potwierdzenia obiecuje wyłącznie
  usunięcie danych finansowych), nie zerował sekwencji ID i nie czyścił ignorowanych sugestii.

### Naprawione — bezpieczeństwo

- PIN nie miał pola potwierdzenia i przyjmował znaki inne niż cyfry — takiego kodu nie dało się
  wpisać na ekranie blokady, co trwale odcinało dostęp do aplikacji.
- `removePin` nie odblokowywało aplikacji, a reset fabryczny nie odświeżał stanu autoryzacji.
- Usunięto ładowanie czcionek z CDN Google — blokowane przez własną politykę CSP aplikacji,
  więc nigdy nie działało, a mimo to generowało próby połączeń sieciowych przy każdym starcie.
- Zaktualizowano zależności: 2 podatności o wysokiej i 1 o średniej istotności (`react-router`, `postcss`).
- Aktualizacja Vite 7 → 8 i `@vitejs/plugin-react` 4 → 6 usuwa ostatnią podatność (odczyt plików
  przez serwer deweloperski na Windows). Vite 8 opiera się na Rolldown/Oxc i nie używa już
  `esbuild`, w którym była luka. **`npm audit`: 0 podatności.**
  Efekt uboczny: build skrócił się z ~6,5 s do ~2 s, a bundle zmalał o ~15 kB.

### Usunięte

- Nieużywane pliki: `useFocusTrap.ts`, `useReadyToAssign.ts`, `App.css`, `react.svg`, `tauri.svg`.
- Martwe komendy i funkcje: `get_transactions_count` (ignorowała filtr konta), `get_budgets`,
  `get_all_budgets`, `get_tags_for_transaction`, `set_transaction_tags`, `delete_setting`.
- Nieużywane zależności: `serde_json`, `tauri-plugin-opener`.

### Zmienione

- Klucze React Query zebrane w jednym miejscu (`queryKeys`); wszystkie zapytania o transakcje
  współdzielą wspólny prefiks, więc jedno unieważnienie odświeża wszystkie zależne widoki.
- Walidacja transakcji ujednolicona w jednej funkcji zamiast trzech rozjeżdżających się kopii.
- Usunięto rzutowania `as any` i typy `any` z warstwy API oraz sygnatur komponentów.
- Testy jednostkowe w Rust: **2 → 27** (salda, carry-over ZBB, harmonogram subskrypcji,
  migracje, reset fabryczny, przypadki brzegowe).

---

## [2.0.3]

- **Audyt UX/UI (Faza 20)** — scentralizowany system komponentów (`Button`, `Modal`, `EmptyState`)
  zamiast setek lokalnych styli, spójny glassmorphism, konfiguracja wariantu `dark:` dla Tailwind v4.

## [2.0.2]

- **Wydajność** — paginacja, filtrowanie i sortowanie przeniesione na silnik SQLite; frontend
  pobiera wyłącznie widoczne dane.
- **Wykrywanie duplikatów w imporcie CSV** — nowy krok weryfikacji porównujący wyciąg z bazą.
- **Nadrabianie zaległych płatności cyklicznych** po długiej nieobecności w aplikacji.
- **Planer celów** — sugerowana miesięczna wpłata liczona z terminu i brakującej kwoty,
  etykiety czasowe z poprawną polską odmianą.
- Naprawa przełączania motywów w Tailwind v4 (`@custom-variant dark`).
- Wyeliminowano `unwrap()` z silnika ZBB.

## [2.0.1]

- Naprawa wskaźnika „Do Rozdysponowania" — ujemne salda kopert sztucznie powiększały RTA.
- Alerty przekroczenia budżetu zintegrowane z silnikiem ZBB (koniec fałszywych ostrzeżeń).
- Usuwanie konta odwraca przelewy zewnętrzne; usuwanie kategorii nie wywala się na `NOT NULL`.
- Relacyjne powiązanie celów z transakcjami (migracja V5).
- Odporny import bazy na Windows (blokady plików, czyszczenie WAL/SHM).

## [2.0.0]

- **Zero-Based Budgeting** — koperty, carry-over, wskaźnik „Do Rozdysponowania", edycja kwot
  bezpośrednio w tabeli.
- **Pasywne wykrywanie subskrypcji** na podstawie analizy historii wydatków.
- **Import CSV z banku** — mapowanie kolumn, interaktywna kategoryzacja, pre-kategoryzacja z historii.
- **Raporty** — cash-flow, trend salda, struktura wydatków; klikalne wykresy z przejściem
  do odfiltrowanej historii.
- **Tagi** (`#hashtagi`) z autouzupełnianiem i wyszukiwaniem.
- Pełna edycja kont, celów i subskrypcji; edycja i usuwanie transakcji wprost z listy.
- Migracja UI na TanStack Query; twarde migracje bazy (`rusqlite_migration`); testy w Rust
  na bazie in-memory.
- Migracja identyfikatorów z `i32` na `i64`.

## [1.0.x]

- Moduł raportowy z filtrami zakresu dat i kont oraz wskaźnikami KPI (Net Flow, Savings Rate).
- Ostrzeżenia przed zejściem na debet.
- PIN hashowany SHA-256 z solą, blokada przed atakiem siłowym, Content Security Policy.
- Paginacja historii transakcji i wirtualizacja listy (`@tanstack/react-virtual`).
- `ErrorBoundary` dla nieprzewidzianych błędów aplikacji.

## [0.1.x] — Fundament

- Tauri 2 (Rust) + React + Vite + Tailwind CSS v4, baza SQLite w `%APPDATA%`.
- Konta, transakcje i przelewy wewnętrzne; budżety miesięczne; cele oszczędnościowe.
- Subskrypcje z automatycznym księgowaniem; Dashboard z wykresami; eksport CSV.
- Blokada PIN, tryb prywatności, edytor kategorii, eksport/import bazy, reset fabryczny.
- Automatyzacja wydań przez GitHub Actions (.exe / .dmg / .deb).
