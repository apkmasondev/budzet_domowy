# Domowy Budżet

Nowoczesna aplikacja desktopowa do zarządzania finansami osobistymi. Działa w 100% offline —
dane nigdy nie opuszczają Twojego komputera.

## Technologie

- **Frontend** — React 19, TypeScript, Vite 8 (Rolldown), Tailwind CSS v4, Zustand (stan globalny),
  TanStack Query (synchronizacja z API Rust), React Router, Recharts, `@tanstack/react-virtual`.
- **Backend** — Tauri 2.x, Rust.
- **Baza danych** — SQLite w `%APPDATA%`, wersjonowany schemat (`rusqlite_migration`),
  tryb WAL, zapytania wyłącznie parametryzowane.

## Kluczowe funkcjonalności

### 💰 Konta i transakcje

- Konta bankowe, gotówkowe i oszczędnościowe.
- Przychody, wydatki i przelewy wewnętrzne z transakcyjną aktualizacją sald.
- System tagów (`#hashtagi`) z autouzupełnianiem i wyszukiwaniem.
- Ostrzeżenie przed zejściem konta poniżej zera.

### 📊 Budżety ZBB (metoda kopertowa)

- Miesięczne koperty dla kategorii z automatycznym przenoszeniem nadwyżek (carry-over).
- Wskaźnik **Do Rozdysponowania** pilnujący, byś nie zaplanował więcej, niż faktycznie masz.
- Przekroczenia nie przechodzą na kolejny miesiąc — są pokrywane z puli do rozdysponowania
  i wyraźnie oznaczane.
- Kopiowanie planu z poprzedniego miesiąca, edycja kwot bezpośrednio w tabeli, sortowanie kolumn.

### 🎯 Cele oszczędnościowe

- Wirtualne skarbonki z terminem realizacji i wyliczaną sugerowaną wpłatą miesięczną.
- Wpłaty księgowane jako zwykłe wydatki, relacyjnie powiązane z celem — edycja lub usunięcie
  takiej transakcji automatycznie koryguje postęp celu.

### 🔁 Subskrypcje i płatności cykliczne

- Częstotliwość tygodniowa, miesięczna, kwartalna i roczna.
- Automatyczne księgowanie zaległych płatności przy starcie aplikacji (nadrabianie długiej
  nieobecności, miesiąc po miesiącu).
- Pasywne wykrywanie subskrypcji — algorytm analizuje historię wydatków pod kątem powtarzalnych
  kwot i odstępów, po czym proponuje ich automatyzację.

### 📥 Import CSV z banku

- Uniwersalne mapowanie kolumn z automatycznym wykrywaniem nagłówka i separatora
  (obsługa plików w `windows-1250`).
- Interaktywne mapowanie kategorii bankowych na własne + pre-kategoryzacja na podstawie historii.
- Wykrywanie duplikatów przed zapisem, z możliwością ręcznej decyzji dla każdego wiersza.

### 📈 Raporty i analityka

- Cash-flow, trend salda (net worth), struktura wydatków — wykresy klikalne, przenoszą do
  odfiltrowanej historii.
- Filtry zakresu dat (1M / 3M / 6M / 12M / YTD / ALL) i wybór kont.
- Eksport widoku do CSV oraz do PDF (przez wydruk).

### 🔒 Bezpieczeństwo i prywatność

- Blokada aplikacji kodem PIN (hash SHA-256 z solą) z czasową blokadą po nieudanych próbach.
- Tryb prywatności ukrywający wszystkie kwoty.
- Eksport i import bazy `.db` z walidacją pliku i automatycznym wycofaniem zmian przy błędzie.
- Brak telemetrii i jakiejkolwiek komunikacji sieciowej.

## Uruchamianie lokalne

Wymagane: Node.js, npm, Rust + Cargo oraz MSVC C++ Build Tools (Windows).

```bash
cd budzet-domowy
```

```bash
npm install
```

```bash
npm run tauri dev
```

## Testy

Logika biznesowa (salda, carry-over ZBB, harmonogram subskrypcji, migracje) jest pokryta
testami jednostkowymi działającymi na bazie SQLite w pamięci:

```bash
cd src-tauri && cargo test
```

Weryfikacja typów i budowanie frontendu:

```bash
npm run build
```

## Dokumentacja

- [CHANGELOG.md](CHANGELOG.md) — historia zmian.
- [audit.md](audit.md) — wyniki ostatniego audytu kodu wraz z listą napraw i znanych ograniczeń.
