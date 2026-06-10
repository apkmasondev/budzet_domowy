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

pub fn init_db(app_dir: PathBuf) -> Result<Connection> {
    // Ensure the app directory exists
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
    }

    let db_path = app_dir.join("budzet.db");
    let mut conn = Connection::open(&db_path)?;

    // Uruchomienie migracji bazy danych (wersjonowanie struktury)
    migrations::run_migrations(&mut conn).expect("Failed to run database migrations");

    // Uruchomienie automatycznego seedowania (domyslne kategorie) jesli tabela jest pusta
    categories::seed_default_categories(&conn)?;
    
    // Migracja kolorów dla istniejących, starych kategorii, które nie miały koloru
    categories::migrate_default_colors(&conn)?;

    Ok(conn)
}
