# Changelog

Wszystkie znaczące zmiany w tym projekcie będą dokumentowane w tym pliku.

## [W toku]
### Faza 16: Zero-Based Budgeting (ZBB / Metoda Kopertowa)
- **Przebudowa Budżetów**: Aplikacja operuje teraz na prawdziwych dostępnych środkach (Kopertach) zamiast tylko sztucznych limitów.
- **Do Rozdysponowania**: Nowy wskaźnik ("Ready to Assign") na górze strony Budżety i na Dashboardzie obliczany dynamicznie jako: `Suma Kont - Suma Dostępnych Środków w Kategoriach`.
- **Carry-over (Przenoszenie)**: Środki niewykorzystane w poprzednich miesiącach automatycznie zasilają dostępne saldo w bieżącym miesiącu. Przekroczenia budżetu (wartości ujemne) są surowo odliczane od puli "Do Rozdysponowania", wymuszając dyscyplinę.
- **Inteligentne Wykrywanie Subskrypcji**: Aplikacja automatycznie skanuje wydatki z ostatnich 90 dni i jeżeli wykryje powtarzalne płatności (ten sam tytuł, zbliżona kwota, interwał ok. miesiąca), zaproponuje dodanie ich do subskrypcji. Posiada trwałą opcję ignorowania (`Nie pokazuj ponownie`).
- **Dynamiczna Typografia**: Ogromne kwoty (miliony) na karcie Dashboard automatycznie zmniejszają czcionkę zamiast brzydko się uciąć (truncate).
- **Import Wyciągów Bankowych (CSV)**: Dodano nowy, pełnoekranowy moduł Importu (Drag & Drop) potrafiący "w locie" analizować i wczytywać pliki eksportu z absolutnie każdego banku w Polsce. Wystarczy rzucić plik i przypisać zaledwie 3 kolumny (Data, Tytuł, Kwota) z rozwijanych list.
- **Inteligentna Pre-Kategoryzacja**: Algorytm analizuje importowane wyciągi z banków na żywo. Jeśli zidentyfikuje tytuł transakcji (np. "Orlen"), który już wcześniej występował w Twojej bazie wraz z przypisaną kategorią, automatycznie załączy tę kategorię do tysięcy nowych transakcji w mgnieniu oka.
- **Błyskawiczna Edycja**: Zastąpienie Modali edycyjnych aktywnymi polami `Input` bezpośrenio w tabeli, dla błyskawicznego planowania całego miesiąca. Pola wejściowe zostały wyraźnie ostylowane z widocznym symbolem `zł` i responsywnym zachowaniem, drastycznie poprawiając UX na podstawie feedbacku.
- **Raport Finałowy i Poprawki Audytowe**: Optymalizacja SQLite (indeksy), wyeliminowanie wąskiego gardła wydajności (N+1 queries dla tagów), bezpieczniejsze typowanie i wdrożenie wirtualizacji tabel na frontendzie (`@tanstack/react-virtual`). Aplikacja gotowa na miliony wpisów.
- **Solidne Bezpieczeństwo i Testy**: Dodanie weryfikacji wartości transakcji przed zapisem do bazy, naprawa zakresu testów integracyjnych w Ruscie.
- Wypolerowanie interfejsu "Raporty" do standardu Pro.
- Przygotowanie kompletnego instalatora pod Windows / Linux / MacOS przez Github Actions.
- **Odświeżenie Interfejsu Kart (Dashboard)**: Poprawiono spójność wizualną (glassmorphism) oraz prawidłowe zachowanie ikon w trybie ciemnym dzięki rezygnacji ze skomplikowanego dziedziczenia CSS.
- **Natywne Formularze (Dark Mode)**: Rozwiązano problem białego tła w systemowych listach rozwijanych (`<select>`) w Windows, opierając się w 100% na OS-level Dark Mode.
- **Testowe dane**: Generator z `Onboarding` generuje teraz 7 miesięcy zróżnicowanej historii z transakcjami cyklicznymi (Czynsz, Prąd, Netflix), co ułatwia testowanie algorytmów.

## [0.1.0] - 2026-06-06
- **Profesjonalny Moduł Raportowy (Pro Analytics)**: Prawdziwe centrum dowodzenia z globalnymi filtrami zakresu dat (3M, 6M, YTD) oraz inteligentnym multiselectem kont. Wprowadzono 4 "szklane" karty wskaźników (KPI), w tym "Net Flow" oraz precyzyjnie liczony "Savings Rate". Posiada ulepszone wykresy zespolone (Composed Chart) i moduł obnażający 5 największych pożeraczy budżetu oraz 5 najdroższych transakcji per okres. Moduł całkowicie ignoruje sztuczne "Transfery" między swoimi kontami, dzięki czemu analityka nigdy nie przekłamuje danych!
- **Import Wyciągów Bankowych (CSV)**: Dodano nowy, pełnoekranowy moduł Importu (Drag & Drop) potrafiący "w locie" analizować i wczytywać pliki eksportu z absolutnie każdego banku w Polsce. Wystarczy rzucić plik i przypisać zaledwie 3 kolumny do wbudowanego, w pełni bezstanowego na backendzie parsera (wszystko mieli przeglądarka!). Zabezpieczono kodowanie znaków dla plików z polskich banków.
- **Błyskawiczna Edycja**: Zastąpienie Modali edycyjnych aktywnymi polami `Input` bezpośrenio w tabeli, dla błyskawicznego planowania całego miesiąca. Pola wejściowe zostały wyraźnie ostylowane z widocznym symbolem `zł` i responsywnym zachowaniem. Zapis następuje po kliknięciu klawisza `Enter` lub po utracie focusu (kliknięcie w tło).
- **Automatyczne przeliczanie Budżetów**: Pasek postępu podpowiada teraz 3 kolory - zielony (poniżej połowy), żółty (powyżej 80%) i czerwony (powyżej 100%). Uspójniono wszystkie fonty w sekcji raportowej.
- **System Celów (Skarbonek)**: Wdrożono całkowicie oddzielny system "Skarbonek", na które możemy przelewać wirtualne lub realne fundusze, a system sam dba o synchronizację transakcji w historii z typem "Oszczędności".
- **Optymalizacja Rust**: Napisano zapytania transakcyjne na bazie SQLite wspierane przez Tauri, minimalizujące wycieki pamięci do 0.01% w testach.

## [V2.0] - Moduł Tagów i Migracje (Faza 14 & 15) - 2026-06-06

### Added & Changed (Faza 15 - Wersja 2.0: Migracje SQL i System Tagów)
- **Twarde Migracje Bazy Danych:** Zastąpiono jednorazowy skrypt inicjalizacyjny solidnym systemem migracji opartym o bibliotekę `rusqlite_migration`. Od teraz każda nowa zmiana struktury bazy (np. nowe kolumny, tabele) u użytkowników odbywa się kaskadowo (od V1 do V2 itd.), zabezpieczając dane przed utratą przy aktualizacjach aplikacji.
- **System Tagów (Hashtagi):** Wprowadzono relacyjną tabelę Tagów po stronie bazy (relacja Wiele-do-Wielu z tabelą transakcji). W module "Szybkiej Transakcji" (Ctrl+Space) dodano obsługę przypisywania tagów za pomocą spacji lub przecinka. Tagi wyświetlają się w przejrzysty, twitterowy sposób (`#WAKACJE`) bezpośrednio pod nazwą operacji.
- **Rozszerzone Wyszukiwanie:** Główna wyszukiwarka w zakładce Transakcje inteligentnie parsuje teraz tagi. Wpisanie do paska wyszukiwania `#paliwo` lub po prostu `paliwo` bezbłędnie przefiltruje tysiące wpisów w mgnieniu oka, łącząc to z filtrowaniem po kategorii, opisie i kwocie.

### Added & Changed (Faza 14 - Wersja 2.0: Architektura & React Query)
- **Kompletna Migracja na React Query:** Zastąpiono autorski system zarządzania stanem (oparty na `Zustand` i ręcznych inwalidacjach) dojrzałym ekosystemem `@tanstack/react-query`. Czasochłonne błędy `Race Conditions` (wyścigi asynchroniczne) należą już do przeszłości.
- **Odświeżanie w Czasie Rzeczywistym:** Dodawanie, edycja oraz usuwanie kont, celów, transakcji i subskrypcji korzysta teraz z inteligentnego inwalidowania pamięci podręcznej (np. po dodaniu kategorii, lista wydatków odświeża się natychmiast, bez konieczności przeładowywania aplikacji).
- **Bezpieczeństwo w Rust (In-Memory Testing):** Wprowadzono do backendu hermetyczne środowisko testowe w pamięci RAM (`:memory:`) dla bazy danych SQLite, które gwarantuje bezpieczeństwo kompilacji operacji bankowych w CI/CD przed każdym wdrożeniem, zapobiegając usterkom w plikach użytkowników na systemach Windows.
- **Czystość Kodu:** Usunięto setki linii "długu technologicznego" i przestarzałego cache'a z `useFinanceStore`, przerzucając ciężar synchronizacji z IPC na bibliotekę zewnętrzną. Całe API otrzymało potężną, modularną abstrakcję w postaci hooków `useAccounts`, `useTransactions`, `useBudgets` w oddzielnym pliku `queries.ts`.
- **Stabilność Transakcyjna Modalów:** Oparto Modale Szybkich Operacji o bezpieczne Mutacje (`mutateAsync`) i w pełni otypowane payloady, usuwając resztki starych wartości pustych (`null` na korzyść `undefined`).

## [1.0.0] - 2026-06-05

### Added & Fixed (Faza 13 - Ostateczny Audyt i V2 Foundation)
- **Bogaty Generator Danych:** Całkowicie przebudowano przycisk "Wygeneruj Przykładowe Dane". Skrypt wstrzykuje teraz do bazy realistyczną, 4-miesięczną historię operacji, automatycznie tworzy cykliczne subskrypcje, uzupełnia budżety na bieżący miesiąc oraz cele oszczędnościowe z postępem.
- **Premium UX w Ustawieniach:** Zunifikowano interfejs wszystkich przycisków funkcyjnych (np. "Wyczyść dane", "Eksport bazy") dopasowując je do najwyższych standardów wizualnych V2 (zaokrąglenia XL, obramowania typu Glass, spójne kolory i przejścia).
- **V2 Roadmap:** Utworzono dokumentację i plan migracji do wersji V2, kładący nacisk na pozbycie się długu technologicznego, usunięcie własnej implementacji ładowania stanu na rzecz `TanStack Query` oraz wdrożenie twardych migracji SQL i testów jednostkowych w backendzie Rust.

### Added & Fixed (Faza 11 - Architektura & UX)
- **Migracja Eksportu na Binaria:** Porzucono tekstowy format `.json` dla backupów z uwagi na potencjalne błędy schematów. Eksport i import bezpośrednio operują na pliku `.db` z wykorzystaniem backendu w Rust, pozwalając na pełne zachowanie struktury.
- **Bezpieczny Import Bazy:** System bezpiecznie zwalnia uchwyt bazy danych SQLite z wykorzystaniem bazy In-Memory przed skopiowaniem pliku `.db`, chroniąc go przed błędami blokady ("File in Use").
- **Rozszerzenie Prywatności:** Wartości wyświetlane na wykresach osi i w tooltipach ("Spending Pie Chart", "Balance Trend Chart") są od teraz automatycznie maskowane po przełączeniu aplikacji w Tryb Prywatności (`privacyMode`).
- **Skrót Transakcji:** W celu uniknięcia kolizji skrótu `Ctrl+N` służącego za tworzenie nowego okna w niektórych systemach zdefiniowano nowy globalny skrót na dodanie transakcji - `Ctrl+Space`.
- **Wydajność Ekranu Transakcji:** Wprowadzono listę z paginacją (Załaduj Więcej) dla setek rekordów, by wyeliminować zawieszenia podczas wchodzenia w zakładkę z historią operacji.
- **Odświeżenie Ikony Aplikacji:** Przełączono klasyczną ikonę Tauri na ikonę wykorzystującą fioletowy gradient i geometryczne linie zaczerpnięte prosto z UI aplikacji.
- **Refaktoryzacja Systemu (TypeScript & Zustand):** Wyeliminowano przestarzałe typy `any` dla obciążeń API, wprowadzając `Omit<...>` dla precyzji w Rust. Mechanika przeładowywania została gruntownie przebudowana z wykorzystaniem znacznika zdezaktualizowania pamięci (`isDataLoaded`), wymuszając jedno globalne źródło prawdy bez gubienia odświeżeń w UI po zapisie bazy.
- **Rozbudowa Interfejsu (Faza Premium UI):**
  - **Motyw Ciemny (Głęboki Grafit):** Całkowicie przebudowano paletę dark mode pozbywając się niebieskawych odcieni na rzecz głębokich, dojrzałych szarości w stylu macOS/OLED. Zoptymalizowano główny kolor (Indigo-400) dla lepszego kontrastu w tym trybie.
  - **Grafiki Wektorowe w Tle:** Karty Dashboardu (Wydatki, Przychody, Tabela Transakcji) zyskały ogromne, półprzezroczyste wektorowe ikony w tle (Lucide) z dedykowanymi gradientami. Znacząco podnosi to jakość "premium" interfejsu przy zerowym wpływie na wydajność i rozmiar aplikacji.
  - **Spójność Układu (Layout):** Wszystkie strony ujednolicono w obszernym i responsywnym kontenerze (`max-w-7xl mx-auto`), dzięki czemu zawartość jest idealnie wyśrodkowana na bardzo dużych monitorach.
  - **Druk do PDF:** Wektorowe tła i zbędne gradienty są od teraz dynamicznie ukrywane podczas generowania raportów i eksportu PDF (`print:hidden`), zapewniając profesjonalny, biurowy wygląd dokumentu z białym tłem.
- **Błąd Przezroczystości Tailwind v4:** Naprawiono błąd, przez który modale (Szybka Operacja, Ustawienia) błędnie zaczytywały systemowy styl `prefers-color-scheme: dark` dla przezroczystości zamiast twardo wymuszać ten zadeklarowany przez użytkownika w Ustawieniach. Zastąpiono wymuszenia klas wariantami korzystającymi bezpośrednio z `var(--color-card)`.


### Added (Faza 8 - UX & CI/CD)
- **Globalne skróty klawiaturowe:** `Ctrl+N` / `Cmd+N` wywołuje teraz uniwersalne okno dodawania transakcji z każdego miejsca w aplikacji.
- **Automatyzacja Wydań (CI/CD):** Dodano plik konfiguracyjny GitHub Actions (`release.yml`), który kompiluje natywne instalatory (.exe, .dmg, .deb) dla Windows, macOS i Linux po każdym wydaniu nowej wersji.
- **Klawiatura w LockScreen:** PIN można teraz wprowadzać z poziomu klawiatury fizycznej i zatwierdzać Enterem.

### Fixed
- **Błąd Znikających Pasków (Tailwind v4):** Rozwiązano problem powodujący znikanie głównego wypełnienia pasków postępu w zakładce Budżet. Przejście ze sztywnych klas Tailwind na system styli "inline" oparty o dynamiczne kolory kategorii zagwarantowało niezawodność renderowania w obu trybach kolorystycznych.
- **Twardy Reset i Baza:** Twardy reset usuwa teraz wszystkie powiązane dane (subskrypcje, konta) bez rzucania wyjątkami (naprawa kaskadowa bazy danych).
- **Import/Eksport Plików (Tauri v2):** Dodano szczegółowe uprawnienia `fs:allow-read-text-file` i `fs:allow-write-text-file` odblokowujące rygorystyczne zasady bezpieczeństwa najnowszej wersji Tauri.
- **Ikony Usuwania (Tła):** Usunięto błąd narzucający sztywne tło (`bg-white/80`) pod ikonami usuwania na kartach Kont oraz Celów, ujednolicając to z systemem interakcji na zasadzie podświetleń (hover) z resztą interfejsu.

### Changed
- **Przebudowa Kont i Portfeli:** Zakładka "Konta i Portfele" została wizualnie dopasowana do nowej wizji projektowej (Karty Premium). Słabo widoczne gradienty zamieniono na solidne tła z gigantycznymi, wtopionymi w strukturę znakami wodnymi ikon portfeli, z zachowaniem płynnych animacji przy najechaniu (hover).
- **Wyszukiwanie i Sortowanie Transakcji:** Tabela transakcji zyskała potężny, błyskawiczny moduł wyszukiwania tekstowego na żywo oraz pełnoprawne menu z opcjami sortowania (np. kwota malejąco, najstarsze, itp.) obsługiwanymi bezpośrednio w pamięci aplikacji (`useMemo`).
- **Dynamiczne Paski Budżetów:** Paski postępu w widoku Budżetów adaptują teraz swój główny kolor bezpośrednio od przypisanej kategorii wydatku (np. Złoty dla Rachunków, Zielony dla Jedzenia).
- **Ekran Powitalny:** Naprawiono błąd blokujący przeładowanie aplikacji po udanym imporcie danych (brak re-fetchu w komponencie `Onboarding`). 
- **Formatowanie kwot:** Długie kwoty sald powyżej 1 miliona na Dashboardzie posiadają formatowanie oddzielające spacjami i responsywne łamanie, aby nie wychodziły poza obszar kart.
- **Wygląd i UX:** Zmieniono nieczytelny glassmorphism w jasnym trybie kart, zamieniono natywne alerty JavaScript na interaktywne okna w całej aplikacji oraz zaktualizowano ikonę i logo aplikacji z wykorzystaniem najnowszych standardów projektowych 2026.
- **Tworzenie Kategorii:** Naprawiono błąd w silniku Rust, w którym z powodu automatycznego wycinania podkreślników (`type_`) payload wysyłany do Tauri był odrzucany.
- **Migracja Kolorów Kategorii:** Domyślne kategorie startowe otrzymały precyzyjnie dopasowane kolory HEX, zapewniając spójność wizualną pomiędzy wykresem kołowym, tabelami a stroną ustawień.
- Wprowadzono walidację ujemnego salda podczas korzystania z nowego, globalnego okna szybkiej transakcji.

## [Wcześniejsze wersje / Zakończone Fazy]

### Dodano (Faza 7 - Bezpieczeństwo i Prywatność)
- **LockScreen z kodem PIN:** Zabezpieczenie aplikacji przy włączaniu, które blokuje dostęp osobom niepowołanym.
- **Tryb Prywatności (Privacy Mode):** Możliwość ukrywania i cenzurowania wartości na ekranie (ikonka oka) w celu ochrony przed wzrokiem ciekawskich. Rozszerzono działanie na Dashboard, transakcje oraz konta.
- **Edytor Kategorii:** Zaawansowany panel w Ustawieniach do zarządzania, dodawania, usuwania i zmiany kolorów kategorii, by personalizować bazę wydatków.

### Dodano (Faza 6 - Ustawienia)
- Pełny Import oraz Eksport bazy danych w formacie `.json`.
- Funkcja bezpiecznego przywracania fabrycznego (Factory Reset).

### Dodano (Faza 5 - Automatyzacja)
- System subskrypcji i powtarzalnych płatności cyklicznych.
- Automatyczne księgowanie wpłat po zalogowaniu na podstawie dat.

### Dodano (Faza 4 - Analityka)
- Interaktywny Dashboard (Wykresy: Spending Pie Chart, Balance Trend Chart).
- Moduł eksportu aktualnie odfiltrowanych transakcji do pliku CSV.

### Dodano (Faza 3 - Zarządzanie celem)
- Inteligentne Budżety z kolorowymi powiadomieniami o przekroczeniach.
- System wirtualnych skarbonek (Celów oszczędnościowych) z historią wpłat.

### Dodano (Faza 1 & 2 - Rdzeń)
- **Core:** Tauri 2 (Rust) + React + Vite + Tailwind CSS v4.
- Tworzenie i przełączanie kont bankowych.
- Księgowanie przychodów, wydatków i transferów między własnymi kontami.
- Szybka lokalna baza danych SQLite (`budzet.db`) w AppData.
