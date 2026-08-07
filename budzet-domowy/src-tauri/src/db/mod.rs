use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;

pub mod accounts;
pub mod categories;
pub mod transactions;
pub mod budgets;
pub mod goals;
pub mod recurring;
pub mod settings;
pub mod migrations;
pub mod tags;
pub mod zbb;
pub fn init_db(app_dir: PathBuf) -> Result<Connection> {
    // Ensure the app directory exists
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
    }

    let db_path = app_dir.join("budzet.db");
    let mut conn = Connection::open(&db_path)?;

    // PRAGMA-y ustawiane zanim cokolwiek dotknie danych.
    configure_connection(&conn)?;

    // Uruchomienie migracji bazy danych (wersjonowanie struktury)
    migrations::run_migrations(&mut conn).expect("Failed to run database migrations");

    // Uruchomienie automatycznego seedowania (domyslne kategorie) jesli tabela jest pusta
    categories::seed_default_categories(&conn)?;
    
    // Migracja kolorów dla istniejących, starych kategorii, które nie miały koloru
    categories::migrate_default_colors(&conn)?;

    Ok(conn)
}

/// Wspólna konfiguracja połączenia. Wywoływana przy starcie aplikacji oraz po
/// każdym ponownym otwarciu bazy (np. po imporcie kopii zapasowej).
///
/// `journal_mode = WAL` to realna zmiana: baza działała dotąd w domyślnym trybie
/// `delete`, przez co `PRAGMA wal_checkpoint(TRUNCATE)` w `export_db` nic nie robiło,
/// a eksport mógł pominąć najświeższe zapisy.
///
/// `foreign_keys = ON` włącza już samo rusqlite — powtarzamy to jawnie, żeby
/// integralność nie zależała od domyślnych ustawień zewnętrznej biblioteki
/// i obowiązywała także dla baz wgranych z zewnątrz przez import.
pub fn configure_connection(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;",
    )
}

/// Czyści wszystkie dane finansowe i przywraca domyślne kategorie.
///
/// Ustawienia bezpieczeństwa (PIN, sól, tryb prywatności) celowo przeżywają reset —
/// okno potwierdzenia w UI obiecuje skasowanie danych finansowych, nie zabezpieczeń.
pub fn factory_reset(conn: &mut Connection) -> Result<()> {
    let tx = conn.transaction()?;
    // Kolejność jest istotna przy włączonych kluczach obcych: najpierw tabele zależne.
    tx.execute_batch(
        "DELETE FROM transaction_tags;
         DELETE FROM tags;
         DELETE FROM transactions;
         DELETE FROM recurring;
         DELETE FROM budgets;
         DELETE FROM goals;
         DELETE FROM accounts;
         DELETE FROM categories;
         DELETE FROM ignored_subscriptions;
         DELETE FROM app_settings WHERE key NOT IN ('app_pin', 'app_pin_salt', 'privacy_mode');",
    )?;

    // sqlite_sequence powstaje dopiero po pierwszym wstawieniu do tabeli z AUTOINCREMENT,
    // więc `DELETE FROM` na nieistniejącej tabeli musi być tolerowany.
    let _ = tx.execute("DELETE FROM sqlite_sequence", []);

    categories::seed_default_categories(&tx)?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Zabezpieczenie przed cichą regresją: `export_db` polega na
    /// `PRAGMA wal_checkpoint(TRUNCATE)`, co ma sens wyłącznie w trybie WAL.
    /// Klucze obce włącza już samo rusqlite, ale ustawiamy je jawnie, żeby
    /// gwarancja nie zależała od domyślnych ustawień biblioteki.
    #[test]
    fn test_connection_is_configured_for_wal_and_foreign_keys() {
        let dir = std::env::temp_dir().join("budzet_pragma_test");
        let _ = fs::remove_dir_all(&dir);
        let conn = init_db(dir.clone()).unwrap();

        let foreign_keys: i64 = conn.query_row("PRAGMA foreign_keys", [], |r| r.get(0)).unwrap();
        assert_eq!(foreign_keys, 1);

        let journal_mode: String = conn.query_row("PRAGMA journal_mode", [], |r| r.get(0)).unwrap();
        assert_eq!(journal_mode.to_lowercase(), "wal");

        drop(conn);
        let _ = fs::remove_dir_all(&dir);
    }

    fn seeded_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        migrations::run_migrations(&mut conn).unwrap();
        configure_connection(&conn).unwrap();
        categories::seed_default_categories(&conn).unwrap();
        conn
    }

    #[test]
    fn test_factory_reset_clears_data_but_keeps_security_settings() {
        let mut conn = seeded_db();
        conn.execute_batch(
            "INSERT INTO accounts (id, name, type, currency, balance) VALUES (1, 'A', 'bank', 'PLN', 100);
             INSERT INTO transactions (account_id, amount, type, date) VALUES (1, 10, 'expense', '2024-01-01');
             INSERT INTO goals (name, target_amount) VALUES ('Cel', 500);
             INSERT INTO budgets (category_id, month, amount) VALUES (1, '2024-01', 100);
             INSERT INTO ignored_subscriptions (description) VALUES ('Netflix');
             INSERT INTO app_settings (key, value) VALUES ('app_pin', 'hash');
             INSERT INTO app_settings (key, value) VALUES ('privacy_mode', 'true');
             INSERT INTO app_settings (key, value) VALUES ('cos_innego', 'x');",
        )
        .unwrap();

        factory_reset(&mut conn).unwrap();

        for table in ["accounts", "transactions", "goals", "budgets", "ignored_subscriptions"] {
            let count: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {}", table), [], |r| r.get(0))
                .unwrap();
            assert_eq!(count, 0, "tabela {} powinna być pusta po resecie", table);
        }

        // Zabezpieczenia zostają...
        let pin: i64 = conn
            .query_row("SELECT COUNT(*) FROM app_settings WHERE key IN ('app_pin', 'privacy_mode')", [], |r| r.get(0))
            .unwrap();
        assert_eq!(pin, 2);
        // ...a pozostałe ustawienia znikają.
        let other: i64 = conn
            .query_row("SELECT COUNT(*) FROM app_settings WHERE key = 'cos_innego'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(other, 0);

        // Domyślne kategorie wracają, a numeracja ID startuje od nowa.
        let categories: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))
            .unwrap();
        assert_eq!(categories, 18);
        let first_id: i64 = conn
            .query_row("SELECT MIN(id) FROM categories", [], |r| r.get(0))
            .unwrap();
        assert_eq!(first_id, 1, "sekwencja AUTOINCREMENT powinna zostać zresetowana");
    }

    /// Reset na świeżej bazie bez ani jednego wstawienia — sqlite_sequence może
    /// wtedy jeszcze nie istnieć i DELETE nie może tego wywrócić.
    #[test]
    fn test_factory_reset_on_untouched_database() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrations::run_migrations(&mut conn).unwrap();
        configure_connection(&conn).unwrap();

        factory_reset(&mut conn).unwrap();

        let categories: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))
            .unwrap();
        assert_eq!(categories, 18);
    }
}
