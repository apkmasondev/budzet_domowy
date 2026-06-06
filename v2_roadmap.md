# Domowy Budżet V2: Wizja i Roadmapa 🚀

Jako programiści zbudowaliśmy solidny fundament. Aplikacja wygląda świetnie, działa błyskawicznie (dzięki Rust/Tauri) i ma zero zewnętrznych zależności, co daje użytkownikowi 100% prywatności. Teraz, patrząc na rynkowe standardy (jak aplikacje Monarch Money, Copilot, czy YNAB z 2026 roku), możemy wejść na wyższy poziom.

Oto plan, jak z dobrej aplikacji zrobić aplikację **wybitną**, z zachowaniem zasad "Clean Code" i bez zaciągania długu technologicznego.

---

## 💎 1. Nowe Funkcje (Wzorowane na rynkowych gigantach)

Obecnie mamy świetny system śledzenia ("co się stało"). Nowoczesne aplikacje skupiają się na **prognozowaniu ("co się stanie")** oraz **optymalizacji**.

* **Pasywny Wykrywacz "Wycieków" (Subscription Leak Detection):**
  * **Co to robi:** Zamiast tylko wpisywać subskrypcje, system może analizować regularne płatności i krzyczeć: *"Uwaga: Twój abonament za Netflix właśnie wzrósł o 15% w tym miesiącu!"* lub *"Od 3 miesięcy nie przypisałeś żadnej ręcznej transakcji do kategorii 'Siłownia', a subskrypcja nadal pobiera 150 zł. Zrezygnować?"*
* **Zero-Based Budgeting (Koperty / Metoda YNAB):**
  * **Co to robi:** Zamiast ustawiać wirtualne budżety (np. 1500 zł na jedzenie), przypisujesz **każdą fizyczną złotówkę z konta** do konkretnego celu. Aplikacja pyta: "Masz 5200 zł na koncie. Jakie zadanie ma każda z tych złotówek przed następną wypłatą?".
* **Proaktywne Prognozowanie (Cashflow Forecasting):**
  * **Co to robi:** Wykres przewidujący stan konta za 3, 6 i 12 miesięcy na podstawie obecnych subskrypcji, średnich wydatków i zaplanowanych wpłat. Symulator "Co-jeśli" (np. *co jeśli kupię ten telewizor za 4000 zł z ratami 300 zł/msc?*).
* **Tagi i Paragony:**
  * Dodawanie wielu tagów (`#wakacje`, `#biznes`) do jednej transakcji oraz możliwość upuszczania zdjęć paragonów (przechowywanych w binarnym Blobie SQLite lub folderze lokalnym).

---

## 🛠️ 2. Sprzątanie Kodu (Spłata Długu Technologicznego)

Skoro jesteśmy przy szczerej, inżynieryjskiej rozmowie, obecny kod jest fajny do prototypu, ale w środowisku produkcyjnym wymagałby kilku ulepszeń architektonicznych:

### A. Backend (Rust & Tauri)

1. **Migracje Bazy Danych (Database Migrations):**
    * *Problem:* Teraz inicjalizujemy bazę jednym wielkim skryptem `init_db`. Gdybyśmy chcieli dodać nową kolumnę do tabeli, musielibyśmy napisać skomplikowany skrypt aktualizujący.
    * *Rozwiązanie:* Zastosować bibliotekę np. `sqlx` lub `refinery`, która trzyma pliki migracji (np. `V1__init.sql`, `V2__add_tags.sql`). Gwarantuje to bezpieczne aktualizacje bazy u użytkowników na produkcji.
2. **Wzorzec Repozytorium (Repository Pattern):**
    * *Problem:* Obecnie w `src-tauri/src/db/` uderzamy bezpośrednio zapytaniami SQL do bazy wewnątrz funkcji.
    * *Rozwiązanie:* Zbudować warstwę abstrakcji (Trait np. `TransactionRepository`). Dzięki temu będziemy mogli wstrzykiwać mocki i napisać testy jednostkowe w Rust (których teraz nie mamy).
3. **Standaryzacja Błędów (Error Handling):**
    * *Problem:* Zwracamy na front błędy jako proste `Result<T, String>`. To tzw. "stringly-typed errors".
    * *Rozwiązanie:* Użycie paczki `thiserror`, zdefiniowanie Enum'ów dla błędów (np. `DbError::NotFound`, `DbError::ConstraintViolation`) i mapowanie ich na kody na frontendzie.

### B. Frontend (React & TypeScript)

1. **Testy Automatyczne (Złota Zasada):**
    * *Problem:* Zero testów. Złamanie logiki przy refaktoryzacji wyjdzie dopiero, gdy "wyklikamy" to na ekranie.
    * *Rozwiązanie:* Wprowadzenie `Vitest` dla logiki biznesowej i `React Testing Library` do testowania komponentów (szczególnie logiki formularzy i kalkulacji budżetów).
2. **Abstrakcja API (API Layer API):**
    * Warto zamienić nasz plik `api.ts` w bardziej obiektową strukturę klas, lub użyć paczek jak `TanStack Query` (React Query) zamiast czystego `Zustanda` z `useEffect`. React Query automatycznie ogarnia inwalidację cache'u, retry, stany ładowania i rozwiązałoby nam problem "race-conditions" z autoryzacją za darmo.
3. **Strict Design Tokens:**
    * Pomimo Tailwinda, wciąż mamy trochę "magicznych liczb" i podawanych z palca klas (np. `bg-primary/10`). Warto stworzyć własne, re-używalne komponenty (np. `<Button variant="glass" />`), oparte na popularnej bibliotece `Radix UI` (Dostępność, wsparcie dla klawiatur i czytników ekranu).

---

## 🚀 Kolejny Krok (Decyzja)

Gdybym miał Ci doradzić od czego zacząć wersję V2:

1. **Natychmiastowo:** Zmienić zarządzanie stanem z `useEffect` na `TanStack Query` + dodać testy logiki do Rusta.
2. **Krótkoterminowo:** Wprowadzić migracje bazy i system Tagów dla transakcji.
3. **Długoterminowo:** Wprowadzić moduł "Prognozy Cashflow" i asystenta wykrywającego abonamenty.
4. **UI/UX:** Pamiętaj o zachowaniu wysokich standardów przy wyglądzie
5. **Changelog:** Uzupełnij pliki readme i changelog
