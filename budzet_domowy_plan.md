# Plan aplikacji: Domowy Budżet

> Aplikacja desktopowa do ręcznego zarządzania budżetem domowym.  
> Darmowa, open source, działa w 100% lokalnie — bez chmury, bez rejestracji.

---

## 1. Założenia projektowe

- Użytkownik **ręcznie wpisuje** każdą transakcję (przychód lub wydatek)
- Dane przechowywane **lokalnie** w pliku SQLite na dysku użytkownika
- Aplikacja działa **offline** — zero połączeń z internetem
- Dystrybuowana jako **darmowy instalator** (.exe / .dmg / .deb)
- Kod otwarty na GitHub (licencja MIT)

---

## 2. Stos technologiczny

| Warstwa | Technologia | Uzasadnienie |
|---|---|---|
| Framework desktopowy | **Tauri 2.x** | Paczka ~5–10 MB, start <0,5s, Windows/Mac/Linux |
| Język backendu (Tauri) | **Rust** | Bezpieczeństwo, wydajność, natywny dostęp do plików |
| Frontend | **React 19 + TypeScript** | Największy ekosystem, silne typowanie |
| Bundler | **Vite 6** | Hot-reload <50ms, szybkie buildy |
| Baza danych | **SQLite** przez `rusqlite` (Tauri) | Jeden plik .db na dysku, brak serwera |
| ORM / zapytania | **sql.js** lub surowe zapytania przez Tauri commands | Prosto, bez nadmiarowych zależności |
| Wykresy | **Recharts** | Natywny React, czytelny API |
| Stylowanie | **Tailwind CSS 4.x** | Zero konfiguracji, szybki build |
| State management | **Zustand** | ~2 KB, prosty, persystencja stanu |
| Komponenty UI | **shadcn/ui** | Dostępne, konfigurowalne, nieogrodzone |
| Ikony | **Lucide React** | Spójna biblioteka, lekka |
| Testy | **Vitest + React Testing Library** | Najszybszy test runner w ekosystemie Vite |
| CI/CD | **GitHub Actions + tauri-action** | Automatyczny build na 3 systemy |

---

## 3. Schemat bazy danych (SQLite)

```sql
-- Konta / portfele użytkownika
CREATE TABLE accounts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,           -- np. "Portfel", "PKO Bank", "Karta Visa"
    type        TEXT NOT NULL,           -- cash | bank | credit | savings
    currency    TEXT NOT NULL DEFAULT 'PLN',
    balance     REAL NOT NULL DEFAULT 0,
    color       TEXT,                    -- kolor hex do rozróżnienia w UI
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Kategorie transakcji
CREATE TABLE categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    icon        TEXT,                    -- nazwa ikony z Lucide
    color       TEXT,                    -- kolor hex
    type        TEXT NOT NULL,           -- income | expense | both
    parent_id   INTEGER REFERENCES categories(id)  -- podkategorie
);

-- Główna tabela transakcji
CREATE TABLE transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    category_id     INTEGER REFERENCES categories(id),
    amount          REAL NOT NULL,       -- zawsze dodatnie
    type            TEXT NOT NULL,       -- income | expense | transfer
    description     TEXT,
    date            TEXT NOT NULL,       -- ISO 8601: "2026-06-01"
    transfer_to_id  INTEGER REFERENCES accounts(id),  -- tylko dla type=transfer
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Budżety miesięczne
CREATE TABLE budgets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    month       TEXT NOT NULL,           -- "2026-06" (rok-miesiąc)
    amount      REAL NOT NULL,           -- limit wydatków
    UNIQUE(category_id, month)
);

-- Cele oszczędnościowe
CREATE TABLE goals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,       -- np. "Wakacje 2027"
    target_amount   REAL NOT NULL,
    current_amount  REAL NOT NULL DEFAULT 0,
    deadline        TEXT,                -- ISO 8601 data docelowa
    icon            TEXT,
    color           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Płatności cykliczne (przypomnienia)
CREATE TABLE recurring (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,       -- np. "Netflix", "Czynsz"
    amount          REAL NOT NULL,
    category_id     INTEGER REFERENCES categories(id),
    account_id      INTEGER REFERENCES accounts(id),
    frequency       TEXT NOT NULL,       -- monthly | weekly | yearly | custom
    next_date       TEXT NOT NULL,       -- kiedy następna płatność
    day_of_month    INTEGER,             -- dla monthly: dzień miesiąca
    active          INTEGER NOT NULL DEFAULT 1
);
```

---

## 4. Moduły aplikacji

### 4.1 Dashboard (strona główna)

- Saldo łączne wszystkich kont
- Saldo per konto (karty z kolorem)
- Wydatki w bieżącym miesiącu vs budżet (pasek postępu)
- Ostatnie 5 transakcji (lista z ikoną kategorii)
- Wykres kołowy wydatków wg kategorii (bieżący miesiąc)
- Alerty: przekroczone budżety, zbliżające się płatności cykliczne

### 4.2 Transakcje

- Lista transakcji z filtrowaniem (konto, kategoria, typ, zakres dat, fraza)
- Sortowanie (data, kwota, kategoria)
- Paginacja lub wirtualizacja dla dużych zbiorów
- Formularz dodawania / edycji transakcji:
  - Typ: Wydatek / Przychód / Przelew między kontami
  - Kwota (z walidacją: tylko liczby, max 2 miejsca dziesiętne)
  - Konto źródłowe (dropdown)
  - Kategoria (dropdown z ikoną i kolorem)
  - Data (domyślnie: dzisiaj, date picker)
  - Opis (opcjonalny, textarea)
  - Dla przelewu: konto docelowe
- Szybkie usuwanie z potwierdzeniem
- Inline edit bezpośrednio na liście

### 4.3 Konta i portfele

- Lista kont z bieżącym saldem
- Dodawanie / edycja / usuwanie konta
- Historia transakcji per konto
- Korekta salda (wpis ręczny do wyrównania z rzeczywistością)

### 4.4 Kategorie

- Domyślne kategorie (predefiniowane przy pierwszym uruchomieniu)
- Tworzenie własnych kategorii z ikoną i kolorem
- Podkategorie (jeden poziom zagłębienia)
- Archiwizacja kategorii (nie usuwa historycznych danych)

**Domyślne kategorie wydatków:**  
Jedzenie, Transport, Mieszkanie, Zdrowie, Rozrywka, Ubrania, Edukacja, Restauracje, Sport, Elektronika, Prezenty, Inne

**Domyślne kategorie przychodów:**  
Wynagrodzenie, Freelance, Dywidendy, Sprzedaż, Inne przychody

### 4.5 Budżety

- Ustawianie miesięcznych limitów wydatków per kategoria
- Pasek postępu: wydano X z Y PLN (kolor zmienia się na czerwony po przekroczeniu)
- Kopiowanie budżetów z poprzedniego miesiąca (jeden klik)
- Widok roczny: ile budżetów przekroczono w każdym miesiącu

### 4.6 Cele oszczędnościowe

- Tworzenie celu z nazwą, kwotą docelową, datą i kolorem
- Ręczne dodawanie wpłat na cel
- Pasek postępu i szacowana data osiągnięcia (przy regularnych wpłatach)
- Powiadomienie desktopowe przy osiągnięciu celu

### 4.7 Płatności cykliczne

- Lista subskrypcji i stałych opłat (Netflix, Spotify, czynsz, itp.)
- Dodawanie z nazwą, kwotą, częstotliwością, datą następnej płatności
- Dashboard pokazuje: "Najbliższe płatności w tym tygodniu"
- Ręczne oznaczanie jako zapłacone (tworzy transakcję automatycznie)
- Powiadomienia desktopowe 1–3 dni przed terminem

### 4.8 Raporty i wykresy

- **Wydatki w czasie** — wykres liniowy/słupkowy, miesięcznie lub tygodniowo
- **Per kategoria** — wykres kołowy + tabela z procentami
- **Porównanie miesięczne** — bar chart: wydatki M-1 vs M-2 vs M-3
- **Przychody vs wydatki** — bilans miesięczny
- **Trend oszczędności** — jak zmienia się saldo w czasie
- Zakres dat: bieżący miesiąc / kwartał / rok / własny
- Eksport raportu do **PDF** (przez webview print)
- Eksport transakcji do **CSV** (backup danych)

### 4.9 Ustawienia

- Waluta domyślna (PLN, EUR, USD, GBP, CZK...)
- Format daty (DD.MM.YYYY lub YYYY-MM-DD)
- Pierwszy dzień tygodnia (pon / niedz)
- Motyw: jasny / ciemny / systemowy
- Kopia zapasowa: eksport całej bazy `.db` w wybrane miejsce
- Przywracanie z backupu
- Język interfejsu (PL / EN)
- Resetowanie danych (z potwierdzeniem)

---

## 5. Struktura projektu

```
budzet-domowy/
├── src-tauri/                  # Backend Rust (Tauri)
│   ├── src/
│   │   ├── main.rs             # Punkt wejścia Tauri
│   │   ├── db/
│   │   │   ├── mod.rs          # Inicjalizacja SQLite, migracje
│   │   │   ├── transactions.rs # CRUD transakcji
│   │   │   ├── accounts.rs     # CRUD kont
│   │   │   ├── categories.rs   # CRUD kategorii
│   │   │   ├── budgets.rs      # CRUD budżetów
│   │   │   ├── goals.rs        # CRUD celów
│   │   │   └── recurring.rs    # CRUD płatności cyklicznych
│   │   ├── commands/           # Tauri commands (API do frontendu)
│   │   │   ├── mod.rs
│   │   │   ├── transaction_commands.rs
│   │   │   ├── account_commands.rs
│   │   │   └── ...
│   │   └── notifications.rs    # Desktop powiadomienia
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                        # Frontend React
│   ├── main.tsx                # Punkt wejścia React
│   ├── App.tsx                 # Router, layout
│   ├── components/
│   │   ├── ui/                 # shadcn/ui (Button, Input, Dialog, ...)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── forms/
│   │   │   ├── TransactionForm.tsx
│   │   │   ├── AccountForm.tsx
│   │   │   └── BudgetForm.tsx
│   │   └── charts/
│   │       ├── SpendingPieChart.tsx
│   │       ├── MonthlyBarChart.tsx
│   │       └── BalanceTrendChart.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Transactions.tsx
│   │   ├── Accounts.tsx
│   │   ├── Budgets.tsx
│   │   ├── Goals.tsx
│   │   ├── Recurring.tsx
│   │   ├── Reports.tsx
│   │   └── Settings.tsx
│   ├── store/
│   │   ├── useTransactionStore.ts
│   │   ├── useAccountStore.ts
│   │   └── useSettingsStore.ts
│   ├── hooks/
│   │   ├── useTransactions.ts
│   │   ├── useBudgets.ts
│   │   └── useGoals.ts
│   ├── lib/
│   │   ├── tauri.ts            # Wrapper na Tauri invoke calls
│   │   ├── formatters.ts       # Formatowanie kwot, dat
│   │   └── validators.ts       # Walidacja formularzy
│   └── types/
│       └── index.ts            # TypeScript interfaces
│
├── .github/
│   └── workflows/
│       └── release.yml         # Build + release na 3 systemy
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

---

## 6. Komunikacja Frontend ↔ Backend (Tauri Commands)

Tauri commands to funkcje Rust wywoływane z TypeScript przez `invoke()`:

```typescript
// Przykłady wywołań z frontendu
import { invoke } from '@tauri-apps/api/core';

// Pobierz transakcje z filtrem
const transactions = await invoke('get_transactions', {
  filters: {
    accountId: null,
    categoryId: null,
    dateFrom: '2026-06-01',
    dateTo: '2026-06-30',
    type: null,
  }
});

// Dodaj transakcję
await invoke('create_transaction', {
  transaction: {
    accountId: 1,
    categoryId: 3,
    amount: 49.99,
    type: 'expense',
    description: 'Biedronka',
    date: '2026-06-05',
  }
});

// Pobierz podsumowanie budżetu na miesiąc
const summary = await invoke('get_budget_summary', { month: '2026-06' });
```

---

## 7. Plan wdrożenia (fazy)

### Faza 1 — Fundament (1–2 tygodnie)

- [ ] Inicjalizacja projektu Tauri + React + TypeScript + Vite
- [ ] Konfiguracja Tailwind CSS i shadcn/ui
- [ ] Schemat bazy danych SQLite + migracje w Rust
- [ ] Podstawowy layout: Sidebar + routing między stronami
- [ ] Domyślne kategorie przy pierwszym uruchomieniu
- [ ] Konfiguracja Vitest

### Faza 2 — Transakcje i konta (2–3 tygodnie)

- [ ] CRUD kont (dodaj/edytuj/usuń/lista)
- [ ] CRUD transakcji (dodaj/edytuj/usuń/lista)
- [ ] Formularz transakcji: wydatek, przychód, przelew
- [ ] Filtrowanie i sortowanie transakcji
- [ ] Aktualizacja salda konta po każdej transakcji
- [ ] Walidacja formularzy

### Faza 3 — Budżety i cele (1–2 tygodnie)

- [ ] Ustawianie budżetów miesięcznych per kategoria
- [ ] Widok budżetów z paskami postępu
- [ ] Kopiowanie budżetów z poprzedniego miesiąca
- [ ] CRUD celów oszczędnościowych
- [ ] Ręczne wpłaty na cele

### Faza 4 — Wykresy i raporty (1–2 tygodnie)

- [ ] Dashboard: saldo, ostatnie transakcje, alerty
- [ ] Wykres kołowy wydatków per kategoria
- [ ] Wykres słupkowy miesięczny (przychody vs wydatki)
- [ ] Wykres trendu salda w czasie
- [ ] Eksport transakcji do CSV
- [ ] Eksport raportu do PDF

### Faza 5 — Płatności cykliczne i powiadomienia (1 tydzień)

- [ ] CRUD płatności cyklicznych
- [ ] Lista "nadchodzące płatności"
- [ ] Oznaczanie jako zapłacone (tworzy transakcję)
- [ ] Desktop powiadomienia (Tauri notification API)

### Faza 6 — Ustawienia, UX, dystrybucja (1–2 tygodnie)

- [ ] Strona ustawień (waluta, motyw, język, backup)
- [ ] Tryb ciemny / jasny / systemowy
- [ ] Eksport i import bazy danych (backup)
- [ ] Onboarding dla nowego użytkownika (kreator pierwszego konta)
- [ ] Skróty klawiaturowe (Ctrl+N nowa transakcja, itp.)
- [ ] Podpisany instalator przez `tauri-action` na GitHub Actions
- [ ] Automatyczne aktualizacje aplikacji

---

## 8. GitHub Actions — automatyczny release

Plik `.github/workflows/release.yml` builduje aplikację na 3 systemy i publikuje instalatory przy każdym tagu `v*`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    permissions:
      contents: write
    strategy:
      matrix:
        include:
          - platform: macos-latest
            args: '--target aarch64-apple-darwin'
          - platform: macos-latest
            args: '--target x86_64-apple-darwin'
          - platform: ubuntu-22.04
            args: ''
          - platform: windows-latest
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-toolchain@stable
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Domowy Budżet ${{ github.ref_name }}'
          releaseBody: 'Nowa wersja aplikacji.'
          releaseDraft: true
          args: ${{ matrix.args }}
```

Wynikiem są gotowe pliki do pobrania:
- Windows: `DomowaBudzet_1.0.0_x64-setup.exe`
- macOS: `DomowaBudzet_1.0.0_aarch64.dmg`
- Linux: `domowy-budzet_1.0.0_amd64.deb`

---

## 9. Bezpieczeństwo i prywatność

- Baza danych w katalogu aplikacji użytkownika (`%APPDATA%` / `~/Library/` / `~/.local/share/`)
- Opcjonalne szyfrowanie pliku `.db` przez **SQLCipher** (hasło przy starcie)
- Zero telemetrii — aplikacja nie wysyła żadnych danych
- Tauri domyślnie blokuje dostęp do plików systemu poza zadeklarowanymi uprawnieniami
- Kod open source — każdy może zweryfikować, co robi aplikacja

---

## 10. Jak uruchomić projekt lokalnie

```bash
# Wymagania wstępne
# - Node.js 20+
# - Rust (https://rustup.rs)
# - Tauri CLI

# 1. Sklonuj repozytorium
git clone https://github.com/twoj-uzytkownik/budzet-domowy.git
cd budzet-domowy

# 2. Zainstaluj zależności JS
npm install

# 3. Uruchom w trybie deweloperskim
npm run tauri dev

# 4. Build produkcyjny (lokalnie)
npm run tauri build
```

---

## 11. Sugerowany prompt startowy dla Claude Code

Wklej poniższy prompt na początku sesji Claude Code:

```
Buduję aplikację desktopową "Domowy Budżet" używając Tauri 2.x + React + TypeScript + SQLite.

Zasady projektu:
- Użytkownik ręcznie wpisuje transakcje — zero importów z banków
- Dane wyłącznie lokalnie w SQLite, zero chmury
- Stack: Tauri 2 (Rust backend), React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, Recharts, Zustand

Schemat DB i plan modułów mam w pliku PLAN.md.

Zacznijmy od: [opisz co chcesz zrobić jako pierwsze, np. "inicjalizacja projektu i schemat SQLite"]
```

---

*Plan wygenerowany: czerwiec 2026*  
*Szacowany czas realizacji MVP: 8–12 tygodni (jedna osoba)*
