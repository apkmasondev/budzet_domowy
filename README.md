# Domowy Budżet - Monorepo

Repozytorium zawiera kompletny ekosystem projektu **Domowy Budżet** (aplikacji desktopowej do finansów osobistych):

1. **[budzet-domowy](file:///d:/Projekty%20AI/Budzet/budzet-domowy)**: Aplikacja desktopowa zbudowana przy użyciu Tauri v2, React, Tailwind CSS v4, SQLite i Rust.
2. **[budzet-domowy-landing](file:///d:/Projekty%20AI/Budzet/budzet-domowy-landing)**: Landing page promocyjny i informacyjny zbudowany w React i Tailwind CSS v4, hostowany na GitHub Pages.

---

## 🌐 Adres Strony (Landing Page)

Po poprawnym skonfigurowaniu GitHub Pages, strona jest dostępna w internecie pod adresem:
👉 **[https://apkmasondev.github.io/budzet_domowy/](https://apkmasondev.github.io/budzet_domowy/)**

---

## 🛠️ Jak uruchomić lokalnie?

### 1. Aplikacja desktopowa (`budzet-domowy`)
Wymaga zainstalowanego środowiska Rust oraz Node.js.
```bash
cd budzet-domowy
npm install
npm run tauri dev
```

### 2. Landing Page (`budzet-domowy-landing`)
Wymaga tylko Node.js.
```bash
cd budzet-domowy-landing
npm install
npm run dev
```

---

## 🚀 Jak wdrożyć stronę na GitHub Pages?

Wdrożenie odbywa się automatycznie przy każdym wypchnięciu (push) zmian na gałąź `main` dzięki zdefiniowanemu przepływowi GitHub Actions ([deploy.yml](file:///d:/Projekty%20AI/Budzet/.github/workflows/deploy.yml)).

Aby strona działała poprawnie w Twoim repozytorium GitHub:
1. Wejdź na swoje repozytorium w przeglądarce: `https://github.com/apkmasondev/budzet_domowy`
2. Przejdź do zakładki **Settings** (Ustawienia) na górnym pasku.
3. Wybierz zakładkę **Pages** z menu po lewej stronie.
4. W sekcji **Build and deployment** znajdź opcję **Source** i zmień ją z **Deploy from a branch** na **GitHub Actions**.
5. Od tej pory każdy `git push` na gałąź `main` automatycznie zbuduje i opublikuje nową wersję strony pod adresem [https://apkmasondev.github.io/budzet_domowy/](https://apkmasondev.github.io/budzet_domowy/).
