# Domowy Budżet - Landing Page

Nowoczesna, responsywna strona internetowa promująca aplikację desktopową **Domowy Budżet**. Zaprojektowana z myślą o najwyższych standardach UX/UI 2026 – zawiera mroczny motyw, efekty szklane (glassmorphism), dynamiczne animacje oraz pełne dopasowanie do urządzeń mobilnych (RWD).

## 🚀 Technologie i Funkcje

- **Framework**: React 18, TypeScript, Vite
- **Stylizowanie**: Tailwind CSS v4 (najnowsza specyfikacja silnika CSS z pełną natywną obsługą zmiennych CSS)
- **Animacje**: Framer Motion (płynne przewijanie, efekty wejścia kart oraz interakcje hover)
- **Ikony**: Lucide React
- **SEO**: Zaimplementowane optymalne meta-tagi (OpenGraph, opisy, słowa kluczowe, ikona aplikacji)
- **Deploy**: Automatyczna integracja z GitHub Pages przez GitHub Actions.

## 📁 Struktura Projektu

- `/src/components`:
  - `Hero.tsx` - Główny panel zachęcający do pobrania aplikacji z logo oraz statystykami.
  - `Features.tsx` - Prezentacja kluczowych cech (prywatność offline, import CSV, tagi, budżet kopertowy ZBB).
  - `CTA.tsx` - Sekcja wezwania do działania (pobieranie wydań instalacyjnych, zintegrowane linki do GitHub Releases).
  - `Footer.tsx` - Prosty stopka z linkami do repozytorium i prawami autorskimi.
- `/public`:
  - `app-icon.svg` - Oryginalne logo i ikona aplikacji przeniesiona bezpośrednio z kodu desktopowego.

## 🛠️ Uruchomienie deweloperskie

Aby uruchomić i edytować stronę lokalnie:

1. Zainstaluj zależności:
   ```bash
   npm install
   ```
2. Uruchom serwer deweloperski Vite:
   ```bash
   npm run dev
   ```
3. Otwórz podany w terminalu adres lokalny (np. `http://localhost:5173/budzet_domowy/`).

## 📦 Budowa produkcyjna

Ręczne generowanie wersji produkcyjnej do folderu `dist`:
```bash
npm run build
```

## 🌐 Wdrożenie na żywo

Projekt jest zintegrowany z GitHub Actions. Każda zmiana wypchnięta na gałąź `main` repozytorium wyzwala proces budowania i automatycznego wrzucenia zmian na GitHub Pages pod adres:
**[https://apkmasondev.github.io/budzet_domowy/](https://apkmasondev.github.io/budzet_domowy/)**

*Pamiętaj o ustawieniu opcji Source na **GitHub Actions** w sekcji Settings -> Pages swojego repozytorium na GitHubie!*
