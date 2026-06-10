# Domowy Budżet

Nowoczesna i szybka aplikacja desktopowa do zarządzania finansami osobistymi, stworzona z wykorzystaniem Tauri (Rust), React i Tailwind CSS v4.

## Technologie

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, Zustand (Stan globalny), TanStack Query (Synchronizacja z Rust API), React Router, Lucide React, Recharts (Analityka), `@tanstack/react-virtual` (Wydajność).
- **Backend (Desktop)**: Tauri 2.x, Rust (Wysoka wydajność, bezpieczeństwo pamięci)
- **Baza Danych**: SQLite (zintegrowana baza w systemie plików w `%APPDATA%`, system migracji, atomowość transakcji, 100% obrona przed SQL Injection)
- **Cechy**: Architektura Offline-First, Zero-Based Budgeting (YNAB style), Pełna Prywatność (Brak telemetrii).

## Etapy budowy

- **Faza 1 (Fundament):** Działające środowisko Tauri, integracja Tailwind CSS, mroczny, "szklany" interfejs.
- **Faza 2 (Konta i Transakcje):** Pełny moduł bankowy. Operacje na przychodach, wydatkach i transferach między kontami.
- **Faza 3 (Budżety i Cele):** Moduły śledzące zaplanowane budżety miesięczne w poszczególnych kategoriach z funkcją ostrzegawczą oraz wirtualne skarbonki na marzenia i cele oszczędnościowe z transakcyjnym systemem wpłat.
- **Faza 4 (Wykresy i Raporty):** Rozbudowany, wizualny Dashboard agregujący statystyki. Wykorzystanie `Recharts` i udostępnienie generowania `PDF` (poprzez modyfikatory print) oraz `CSV`.
- **Faza 5 (Automatyzacja):** System powtarzalnych płatności stałych i subskrypcji z wbudowanym asystentem inteligentnie odliczającym i autoksięgującym transakcje natychmiast po wejściu w aplikację.
- **Faza 6 (Import / Eksport danych):** Kompletny panel sterowania posiadający pro-architekturę eksportu oraz importu całej bazy SQLite w przyjaznym, edytowalnym formacie JSON z obsługą wyjątków i transakcji odtwarzania.

## Kluczowe Funkcjonalności

### 💰 Zarządzanie Kontami i Transakcjami

- Twórz różne konta finansowe (bankowe, gotówkowe, oszczędnościowe).
- Rejestruj przychody, wydatki i wewnętrzne transfery bez utraty spójności.
- System tagowania ułatwia szybkie wyszukiwanie wydatków.

### 📊 Zarządzanie Budżetami (ZBB - Metoda Kopertowa)

- Ustawiaj miesięczne koperty dla kategorii i przenoś niewykorzystane resztki (carry-over) z miesiąca na miesiąc.
- Globalny wskaźnik **Do Rozdysponowania** pilnuje dyscypliny - nie wydasz więcej gotówki, niż aktualnie posiadasz.
- Możliwość kopiowania planu budżetów z poprzedniego miesiąca.

### 🎯 Cele Oszczędnościowe z transakcyjnym systemem wpłat

- **Faza 7 (Bezpieczeństwo i Prywatność):** Zabezpieczenie aplikacji autorskim ekranem PIN, ukrywanie kwot pod Trybem Prywatności oraz potężny edytor do zarządzania własnymi kolorowymi kategoriami z poziomu Ustawień.
- **Faza 8 (Finalny UX i CI/CD):** Optymalizacja pod power-userów (Globalne modale na skrót Ctrl+N) oraz oskryptowanie GitHub Actions do w pełni automatycznej kompilacji paczek instalacyjnych .exe, .dmg oraz .deb dla każdego wydania w chmurze!
- **Faza 9 (Dialogi i Pliki w Tauri v2):** Migracja przestarzałych natywnych funkcji przeglądarki (`alert`, `window.confirm`) na nowoczesne komponenty interfejsu oraz użycie bezpiecznego zapisu/odczytu i natywnego okna przeglądania plików dzięki wtyczkom `@tauri-apps/plugin-dialog` oraz `plugin-fs`.
- **Faza 10 (Detale, UI/UX Polish):** Zaprojektowanie i wygenerowanie unikatowej ikony i logo aplikacji. Wprowadzenie zaawansowanego formatowania bardzo dużych kwot, czytelnych kolorów przychodów i wydatków oraz szlifowanie logiki importowania i generowania testowych danych bazy SQLite w celu uniknięcia dead-locków w routingu.
- **Faza 11 (Refaktoryzacja Architektury):** Zastąpienie podatnego na awarie tekstowego eksportu JSON w pełni binarnym kopiowaniem bezpośrednio bazy `.db` w Rust, precyzyjne interfejsy TypeScript (`Omit`), zoptymalizowana paginacja na liście transakcji oraz naprawa stanu zdezaktualizowania cache z `isDataLoaded` w Zustand.
- **Faza 12 (Premium UX & Design):** Pełny audyt wizualny owocujący wdrożeniem dojrzałego, graficznego motywu "Głęboki Grafit" w stylu macOS. Implementacja dynamicznych, niewpływających na wydajność wektorowych grafik w tłach najważniejszych kart informacyjnych oraz perfekcyjne wyśrodkowanie i ujednolicenie siatki wszystkich podstron (Layout) na najszerszych monitorach z rygorystycznymi wyjątkami pod czysty druk do formatu PDF.
- **Faza 13 (Szlifowanie UI i Ostateczny Audyt):** Rozwiązanie problemów z renderowaniem opacity i flexbox w nowym silniku Tailwind v4, dodanie zaawansowanego sortowania i błyskawicznego wyszukiwania transakcji w locie (`useMemo`) oraz przeprojektowanie układu Kont na luksusowe karty z masywnymi znakami wodnymi. Zakończenie fazy deweloperskiej rygorystycznym audytem całego projektu (`audit.md`) oraz rozbudową generatora testowych danych.

- **Faza 14 (Architektura v2 & React Query):** Wymiana serca aplikacji – usunięcie starych wywołań wewnątrz `useEffect` i wdrożenie profesjonalnej biblioteki `@tanstack/react-query`. Oddzielenie warstwy komunikacji (API) od komponentów, automatyczna inwalidacja zapytań (cache) oraz dodanie testów jednostkowych w języku Rust operujących na izolowanej od dysku, in-memory bazie danych SQLite, co zapewnia w 100% stabilne CI/CD i potężny fundament pod kolejne funkcje w v2.
- **Faza 15 (Migracje Bazy i Tagi):** Zastąpiono sztywny skrypt `schema.sql` solidnym systemem kaskadowych, twardych migracji (`rusqlite_migration`). Ochroni to użytkowników przed utratą danych podczas większych aktualizacji. Rozbudowano transakcje o wielowymiarowy i zoptymalizowany system relacyjnych Tagów (`#Hashtagi`) wyposażony we własne algorytmy szybkiego wyszukiwania.

## Wersja 2.0.0 - Wersja Stabilna

Rozpoczęto wdrażanie potężnej architektonicznej aktualizacji. Do tej pory ukończono:

- [x] Pełna Edycja Elementów: Wprowadzono długo wyczekiwaną możliwość edytowania już istniejących Kont, Portfeli, Celów oszczędnościowych oraz Płatności Cyklicznych (Subskrypcji).
- [x] Interaktywny Dashboard: Kafelki na głównym ekranie przekierowują do odpowiadających im zakładek po kliknięciu.
- [x] Wygodny interfejs edycji i usuwania w zakładce Kont i Portfeli z ikonami przeniesionymi w łatwo dostępne, prawe górne rogi kart.
- [x] Migracja całego UI na hooki TanStack Query, eliminacja wyścigów asynchronicznych (Race Conditions).
- [x] Implementacja bezpiecznego środowiska testowego (In-Memory SQLite) po stronie Rust.
- [x] Twarde migracje bazy danych (za pomocą `rusqlite_migration`) zabezpieczające starą strukturę przed awarią.
- [x] Nowy, Twitterowy system Tagów (`#hashtagów`) krzyżowych dla poszczególnych transakcji zintegrowany z potężną wyszukiwarką.
- [x] Faza 16: Zero-Based Budgeting (ZBB) - Metoda Kopertowa. Globalny wskaźnik do rozdysponowania, automatyczne "carry-over" niewykorzystanych środków oraz surowe wymuszanie pokrycia przekroczeń. Płynne wejścia inline bezpośrednio w tabelach oraz dopracowany UX.
- [x] Faza 17: Pasywne wykrywanie subskrypcji - algorytm śledzący historię wydatków pod kątem cykliczności i sugerujący ich zautomatyzowanie.
- [x] Faza 18: Ostateczne szlify UX (Premium UI) - Glassmorphism w dropdownach filtrów, naprawione błędy z edycją przelewów, pełna interaktywność klikalna na wykresach Cash-Flow i raportach.
- [x] Faza 17: Inteligentny import ze zrzutami bankowymi (CSV). Silnik uniwersalnego mapowania kolumn i interaktywne okno kategoryzacji transakcji z banku "w locie" wraz z algorytmem pre-kategoryzacji z historii wydatków. Wbudowany parser PapaParse eliminuje potrzebę własnego serwera.
- [x] Błyskawiczna edycja i usuwanie transakcji (Inline Action Buttons) zintegrowane w wierszach tabel z płynnym wysuwaniem po lewej stronie kwoty (kwota pozostaje cały czas widoczna), zintegrowane z przeliczaniem sald na zapleczu (Rust).
- [x] Faza 18: Zaawansowane Raportowanie (Roczne Cash-flow), 3 zaawansowane wykresy (Recharts) do analityki finansowej. Filtry responsywne na małych oknach.

- [x] Paginacja backendowa historii transakcji i migracja na InfiniteQuery w React.
- [x] Całkowite przepisanie logiki ZBB na szybki backend Rust z nową strukturą.
- [x] Migracja wszystkich ID z i32 na i64 zabezpieczająca bazę SQLite.
- [x] UX Polish: Usunięcie poziomych pasków przewijania, ujednolicone i poprawione ikony edycji/usuwania (w tym usunięcie obcinania w historii i dopasowanie podświetlenia dla trybu jasnego) oraz animacje kart w Kontach.
- [x] Faza 19 (Interaktywność): Klikalne, w pełni interaktywne wykresy kołowe na Dashboardzie z przekierowaniem, Podgląd Szybkich Transakcji po kliknięciu kart na Kontach i Portfelach. Kafelki "Przychody" oraz "Wydatki" automatycznie przypisujące rodzaj filtra w tabeli wpisów.
- [x] Focus Trap w globalnych modalach, pełna zdatność klawiatury (`Escape`), moduł Autouzupełniania Tagów (Hashtagów) z "w-locie" listą podpowiedzi oraz interaktywne tagi w historii potrafiące aktywować globalne filtrowanie po kliknięciu.
- [x] Filtr 1M w zaawansowanej analityce ułatwiający rozeznanie się w budżecie w cyklu miesięcznym. Pasek wyszukiwania transakcji doposażony w super-szybkie filtrowanie po dacie. Zmiana nazewnictwa "Wszystkie/Wszystkie okresy" na "ALL" w Raportach oraz Transakcjach w celu oszczędności miejsca. Inteligentny Eksport CSV oparty na przefiltrowanym widoku.
- [x] Wskaźniki opłacenia subskrypcji w bieżącym miesiącu na Dashboardzie i liście zleceń. Interaktywne sortowanie kolumn (alfabetycznie oraz po kwotach) i przyklejona belka nagłówków (sticky head) w Budżetach. Złoty motyw wizualny z podwyższonym kontrastem w trybie jasnym, ikona trofeum i odznaka sukcesu dla zrealizowanych celów oszczędnościowych. Klikalność ostatnich transakcji na Dashboardzie przenosząca do historii transakcji z autofiltrem. Pełna edycja i personalizacja istniejących kategorii w Ustawieniach. Poprawiony kontrast filtrów zakresu dat i kont w sekcji Raporty (tryb ciemny). Zoptymalizowana tabela budżetowa: brak prześwitywania wierszy pod nagłówkiem (dzięki border-collapse i solidnemu bg-card na thead/tr/th) oraz dynamicznie dostosowywana wysokość listy (max-h-[calc(100vh-340px)]) dla pełnego wykorzystania ekranu.

Wszystkie cele projektowe w tym wydaniu zostały zrealizowane! 🎉

## Uruchamianie lokalne

Wymagane środowisko to Node.js, npm oraz instalacja języka Rust, Cargo oraz MSVC C++ Build Tools (wymagane w systemie Windows).

1. Przejdź do folderu aplikacji:

   ```bash
   cd budzet-domowy
   ```

2. Zainstaluj paczki JS (przy pierwszym uruchomieniu):

   ```bash
   npm install
   ```

3. Uruchom serwer developerski Tauri (zajmie się pobraniem paczek Cargo i budowaniem):

   ```bash
   npm run tauri dev
   ```
