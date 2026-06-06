-- Konta / portfele użytkownika
CREATE TABLE IF NOT EXISTS accounts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'PLN',
    balance     REAL NOT NULL DEFAULT 0,
    color       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Kategorie transakcji
CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    icon        TEXT,
    color       TEXT,
    type        TEXT NOT NULL,
    parent_id   INTEGER REFERENCES categories(id)
);

-- Główna tabela transakcji
CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    category_id     INTEGER REFERENCES categories(id),
    amount          REAL NOT NULL,
    type            TEXT NOT NULL,
    description     TEXT,
    date            TEXT NOT NULL,
    transfer_to_id  INTEGER REFERENCES accounts(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Budżety miesięczne
CREATE TABLE IF NOT EXISTS budgets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    month       TEXT NOT NULL,
    amount      REAL NOT NULL,
    UNIQUE(category_id, month)
);

-- Cele oszczędnościowe
CREATE TABLE IF NOT EXISTS goals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    target_amount   REAL NOT NULL,
    current_amount  REAL NOT NULL DEFAULT 0,
    deadline        TEXT,
    icon            TEXT,
    color           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Płatności cykliczne (przypomnienia)
CREATE TABLE IF NOT EXISTS recurring (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    amount          REAL NOT NULL,
    category_id     INTEGER REFERENCES categories(id),
    account_id      INTEGER REFERENCES accounts(id),
    frequency       TEXT NOT NULL,
    next_date       TEXT NOT NULL,
    day_of_month    INTEGER,
    active          INTEGER NOT NULL DEFAULT 1
);

-- Ustawienia aplikacji (Klucz, Wartość)
CREATE TABLE IF NOT EXISTS app_settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);
