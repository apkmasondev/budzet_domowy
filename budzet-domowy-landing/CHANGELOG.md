# Changelog - Landing Page (budzet-domowy-landing)

Wszystkie znaczące zmiany w projekcie strony internetowej (Landing Page) będą dokumentowane w tym pliku.

## [1.0.0] - 2026-06-06

### Added
- **Scaffolding projektu**: Zainicjalizowano czysty projekt React + TypeScript + Vite + Tailwind CSS v4.
- **Mroczny Design (OLED)**: Zaimplementowano nowoczesny, ekskluzywny motyw graficzny z elementami szklanymi (glassmorphism) i harmonijnymi gradientami.
- **Struktura Komponentów**:
  - `Hero`: Nagłówek z unikalną prezentacją, dynamicznym wejściem (Framer Motion) i linkami do pobrania.
  - `Features`: Prezentacja kluczowych zalet aplikacji desktopowej (Prywatność offline, import CSV z banków, Hashtagi w transakcjach, budżet kopertowy ZBB).
  - `CTA`: Wygodne odnośniki do pobierania instalatorów z wydań na GitHubie.
  - `Footer`: Stopka z informacjami o prawach autorskich oraz linkiem do kodu źródłowego.
- **Ikona Aplikacji**: Skopiowano oryginalną wektorową ikonę portfela (`app-icon.svg`) z aplikacji desktopowej i umieszczono w widocznym miejscu na stronie oraz jako favicon.
- **Optymalizacja pod SEO**: Dodano semantyczny kod HTML, znaczniki OpenGraph, opisy oraz słowa kluczowe w pliku `index.html`.
- **Wdrożenie GitHub Actions**: Stworzono plik przepływu `.github/workflows/deploy.yml` automatycznie kompilujący projekt i publikujący go na GitHub Pages po każdym pushu na gałąź `main`.
