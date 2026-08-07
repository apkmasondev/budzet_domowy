use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

pub fn get_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("schema.sql")), // V1 - base schema
        M::up(
            "
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT
            );

            CREATE TABLE IF NOT EXISTS transaction_tags (
                transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (transaction_id, tag_id)
            );
            ",
        ), // V2 - tags support
        M::up(
            "
            CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
            ",
        ), // V3 - performance indexes
        M::up(
            "
            CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag_id ON transaction_tags(tag_id);
            ",
        ), // V4 - missing tag index
        M::up(
            "
            ALTER TABLE transactions ADD COLUMN goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at);
            ",
        ), // V5 - goal dependency and index
        M::up(
            "
            -- Indeksy pod zapytania, które realnie wykonuje aplikacja.
            -- `date` jest filtrowane/grupowane praktycznie wszędzie (ZBB, dashboard,
            -- historia, wykrywanie subskrypcji), a wcześniej nie miało indeksu.
            CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
            CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
            CREATE INDEX IF NOT EXISTS idx_transactions_transfer_to_id ON transactions(transfer_to_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_goal_id ON transactions(goal_id);
            CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
            CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON recurring(next_date, active);

            -- Defensywne sprzątanie wiszących referencji. rusqlite trzyma
            -- `PRAGMA foreign_keys = ON`, więc w normalnej pracy aplikacji sieroty nie
            -- powstają — ale baza może trafić tu przez import dowolnego pliku .db
            -- (`import_db`), wyprodukowanego np. przez narzędzie bez wymuszania FK.
            -- Zapytania są idempotentne i na zdrowej bazie nic nie zmieniają.
            DELETE FROM transaction_tags
             WHERE transaction_id NOT IN (SELECT id FROM transactions)
                OR tag_id NOT IN (SELECT id FROM tags);
            UPDATE transactions SET goal_id = NULL
             WHERE goal_id IS NOT NULL AND goal_id NOT IN (SELECT id FROM goals);
            UPDATE transactions SET category_id = NULL
             WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM categories);
            UPDATE transactions SET transfer_to_id = NULL
             WHERE transfer_to_id IS NOT NULL AND transfer_to_id NOT IN (SELECT id FROM accounts);
            UPDATE recurring SET category_id = NULL
             WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM categories);
            UPDATE recurring SET account_id = NULL
             WHERE account_id IS NOT NULL AND account_id NOT IN (SELECT id FROM accounts);
            DELETE FROM budgets WHERE category_id NOT IN (SELECT id FROM categories);
            DELETE FROM transactions WHERE account_id NOT IN (SELECT id FROM accounts);
            ",
        ), // V6 - query indexes and orphan cleanup before enabling foreign keys
        M::up(
            "
            -- Ignorowane sugestie subskrypcji trzymane były jako jeden string
            -- rozdzielany przecinkami w app_settings. Opisy z wyciągów bankowych
            -- regularnie zawierają przecinki, więc wpis rozpadał się na kawałki
            -- i sugestia wracała mimo ukrycia.
            CREATE TABLE IF NOT EXISTS ignored_subscriptions (
                description TEXT PRIMARY KEY
            );

            -- Przenosimy stare wpisy rozbijając je po przecinku (rekurencyjne CTE),
            -- czyli dokładnie tak, jak interpretował je dotychczasowy kod.
            INSERT OR IGNORE INTO ignored_subscriptions (description)
            WITH RECURSIVE split(head, rest) AS (
                SELECT '', value || ',' FROM app_settings WHERE key = 'ignored_subscriptions'
                UNION ALL
                SELECT SUBSTR(rest, 1, INSTR(rest, ',') - 1),
                       SUBSTR(rest, INSTR(rest, ',') + 1)
                  FROM split WHERE rest != ''
            )
            SELECT TRIM(head) FROM split WHERE TRIM(head) != '';

            DELETE FROM app_settings WHERE key = 'ignored_subscriptions';
            ",
        ), // V7 - ignored subscription suggestions moved to their own table
    ])
}

pub fn run_migrations(conn: &mut Connection) -> Result<(), rusqlite_migration::Error> {
    let migrations = get_migrations();
    migrations.to_latest(conn)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    /// Migracje muszą dać się nałożyć na czystą bazę i być idempotentne.
    #[test]
    fn test_migrations_apply_to_fresh_database() {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&mut conn).unwrap();
        run_migrations(&mut conn).unwrap();

        let tables: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN
                 ('accounts','categories','transactions','budgets','goals','recurring',
                  'app_settings','tags','transaction_tags','ignored_subscriptions')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(tables, 10);
    }

    /// Aktualizacja bazy z poprzedniej wersji aplikacji nie może zgubić danych.
    /// Sprzątanie z V6 na zdrowej bazie musi być całkowicie bezinwazyjne.
    #[test]
    fn test_upgrade_from_v5_preserves_valid_data() {
        let mut conn = Connection::open_in_memory().unwrap();
        get_migrations().to_version(&mut conn, 5).unwrap();

        conn.execute_batch(
            "INSERT INTO accounts (id, name, type, currency, balance) VALUES (1, 'A', 'bank', 'PLN', 100);
             INSERT INTO categories (id, name, type) VALUES (1, 'Jedzenie', 'expense');
             INSERT INTO goals (id, name, target_amount) VALUES (1, 'Cel', 1000);
             INSERT INTO transactions (id, account_id, category_id, amount, type, date, goal_id)
                    VALUES (1, 1, 1, 50, 'expense', '2024-01-01', 1);
             INSERT INTO tags (id, name) VALUES (1, 'tag');
             INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (1, 1);
             INSERT INTO budgets (category_id, month, amount) VALUES (1, '2024-01', 500);
             INSERT INTO recurring (id, name, amount, category_id, account_id, frequency, next_date)
                    VALUES (1, 'Netflix', 43, 1, 1, 'monthly', '2024-02-01');",
        )
        .unwrap();

        run_migrations(&mut conn).unwrap();

        let kept: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE id = 1 AND goal_id = 1 AND category_id = 1",
                [], |r| r.get(0),
            )
            .unwrap();
        assert_eq!(kept, 1, "poprawna transakcja nie może zostać ruszona przez sprzątanie");

        for (table, expected) in [("transaction_tags", 1), ("budgets", 1), ("recurring", 1), ("tags", 1)] {
            let count: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |r| r.get(0))
                .unwrap();
            assert_eq!(count, expected, "tabela {} straciła dane przy migracji", table);
        }

        let violations: i64 = conn
            .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |r| r.get(0))
            .unwrap();
        assert_eq!(violations, 0);
    }

    /// Sprzątanie z V6 faktycznie usuwa wiszące referencje, gdyby trafiły do bazy
    /// przez import pliku .db wyprodukowanego bez wymuszania kluczy obcych.
    #[test]
    fn test_v6_cleanup_removes_dangling_references() {
        let mut conn = Connection::open_in_memory().unwrap();
        get_migrations().to_version(&mut conn, 5).unwrap();

        // Symulujemy plik z zewnątrz: wyłączamy FK na czas wstawiania sierot.
        conn.execute_batch("PRAGMA foreign_keys = OFF;").unwrap();
        conn.execute_batch(
            "INSERT INTO accounts (id, name, type, currency, balance) VALUES (1, 'A', 'bank', 'PLN', 100);
             INSERT INTO transactions (id, account_id, category_id, amount, type, date, goal_id)
                    VALUES (2, 1, 999, 10, 'expense', '2024-01-02', 998);
             INSERT INTO transactions (id, account_id, amount, type, date)
                    VALUES (3, 995, 10, 'expense', '2024-01-03');
             INSERT INTO budgets (category_id, month, amount) VALUES (996, '2024-01', 500);",
        )
        .unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        run_migrations(&mut conn).unwrap();

        let dangling: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM transactions WHERE goal_id = 998 OR category_id = 999",
                [], |r| r.get(0),
            )
            .unwrap();
        assert_eq!(dangling, 0, "wiszące goal_id/category_id powinny zostać wyzerowane");

        let orphan_tx: i64 = conn
            .query_row("SELECT COUNT(*) FROM transactions WHERE id = 3", [], |r| r.get(0))
            .unwrap();
        assert_eq!(orphan_tx, 0, "transakcja bez istniejącego konta powinna zniknąć");

        let orphan_budgets: i64 = conn
            .query_row("SELECT COUNT(*) FROM budgets WHERE category_id = 996", [], |r| r.get(0))
            .unwrap();
        assert_eq!(orphan_budgets, 0);

        let violations: i64 = conn
            .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |r| r.get(0))
            .unwrap();
        assert_eq!(violations, 0, "po sprzątaniu baza musi być spójna dla kluczy obcych");
    }

    /// V7 przenosi ignorowane sugestie z pola tekstowego do własnej tabeli.
    #[test]
    fn test_ignored_subscriptions_migrated_from_settings() {
        let mut conn = Connection::open_in_memory().unwrap();
        get_migrations().to_version(&mut conn, 6).unwrap();
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES ('ignored_subscriptions', 'Netflix,Spotify Premium')",
            [],
        )
        .unwrap();

        run_migrations(&mut conn).unwrap();

        let mut stmt = conn.prepare("SELECT description FROM ignored_subscriptions ORDER BY description").unwrap();
        let rows: Vec<String> = stmt.query_map([], |r| r.get(0)).unwrap().collect::<rusqlite::Result<_>>().unwrap();
        assert_eq!(rows, vec!["Netflix".to_string(), "Spotify Premium".to_string()]);

        let leftover: i64 = conn
            .query_row("SELECT COUNT(*) FROM app_settings WHERE key = 'ignored_subscriptions'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(leftover, 0);
    }
}
