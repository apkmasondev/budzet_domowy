pub mod db;
use tauri::{Manager, State};
use std::sync::Mutex;
use rusqlite::Connection;

#[tauri::command]
fn get_accounts(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::accounts::Account>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::accounts::get_accounts(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_account(state: State<'_, Mutex<Connection>>, payload: db::accounts::CreateAccountPayload) -> Result<i64, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::accounts::create_account(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_account(state: State<'_, Mutex<Connection>>, id: i64) -> Result<(), String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    db::accounts::delete_account(&mut conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_account(state: State<'_, Mutex<Connection>>, id: i64, payload: db::accounts::UpdateAccountPayload) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::accounts::update_account(&conn, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_categories(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::categories::Category>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::categories::get_categories(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_transaction(state: State<'_, Mutex<Connection>>, payload: db::transactions::CreateTransactionPayload) -> Result<i64, String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    db::transactions::create_transaction(&mut conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn bulk_insert_transactions(state: State<'_, Mutex<Connection>>, payloads: Vec<db::transactions::CreateTransactionPayload>) -> Result<usize, String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    db::transactions::bulk_insert_transactions(&mut conn, payloads).map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)] // Parametry komendy Tauri muszą być płaskie i nazwane.
fn get_transactions(
    state: State<'_, Mutex<Connection>>,
    limit: u32, 
    offset: u32,
    search: Option<String>,
    month: Option<String>,
    tx_type: Option<String>,
    sort_by: Option<String>,
    account_id: Option<i64>
) -> Result<Vec<db::transactions::Transaction>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::transactions::get_transactions(&conn, limit, offset, search, month, tx_type, sort_by, account_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_transaction_months(state: State<'_, Mutex<Connection>>) -> Result<Vec<String>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::transactions::get_transaction_months(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_dashboard_stats(state: State<'_, Mutex<Connection>>, month: String) -> Result<db::transactions::DashboardStats, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::transactions::get_dashboard_stats(&conn, &month).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_transaction_by_id(state: State<'_, Mutex<Connection>>, id: i64) -> Result<db::transactions::Transaction, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::transactions::get_transaction_by_id(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_budget_states(state: State<'_, Mutex<Connection>>, month: &str) -> Result<Vec<db::zbb::CategoryState>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::zbb::get_budget_states(&conn, month).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_ready_to_assign(state: State<'_, Mutex<Connection>>) -> Result<f64, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::zbb::get_ready_to_assign(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_transaction(state: State<'_, Mutex<Connection>>, id: i64) -> Result<(), String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    db::transactions::delete_transaction(&mut conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_transaction(state: State<'_, Mutex<Connection>>, id: i64, payload: db::transactions::UpdateTransactionPayload) -> Result<(), String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    db::transactions::update_transaction(&mut conn, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_tags(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::tags::Tag>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::tags::get_all_tags(&conn).map_err(|e| e.to_string())
}

// Budgets
// Surowe listy budżetów (`get_budgets` / `get_all_budgets`) zostały usunięte —
// UI korzysta wyłącznie z `get_budget_states`, które zwraca policzone stany ZBB.
#[tauri::command]
fn upsert_budget(state: State<'_, Mutex<Connection>>, payload: db::budgets::UpsertBudgetPayload) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::budgets::upsert_budget(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_budgets_to_month(state: State<'_, Mutex<Connection>>, from_month: &str, to_month: &str) -> Result<(), String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    db::budgets::copy_budgets_to_month(&mut conn, from_month, to_month).map_err(|e| e.to_string())
}

// Goals
#[tauri::command]
fn get_goals(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::goals::Goal>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::goals::get_goals(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_goal(state: State<'_, Mutex<Connection>>, payload: db::goals::CreateGoalPayload) -> Result<i64, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::goals::create_goal(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_goal(state: State<'_, Mutex<Connection>>, id: i64) -> Result<(), String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    db::goals::delete_goal(&mut conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_to_goal(state: State<'_, Mutex<Connection>>, payload: db::goals::AddToGoalPayload) -> Result<(), String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    db::goals::add_to_goal(&mut conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_goal(state: State<'_, Mutex<Connection>>, id: i64, payload: db::goals::UpdateGoalPayload) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::goals::update_goal(&conn, id, payload).map_err(|e| e.to_string())
}

// Recurring
#[tauri::command]
fn get_recurrings(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::recurring::Recurring>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::recurring::get_recurrings(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_recurring(state: State<'_, Mutex<Connection>>, payload: db::recurring::CreateRecurring) -> Result<i64, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::recurring::create_recurring(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_recurring(state: State<'_, Mutex<Connection>>, id: i64) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::recurring::delete_recurring(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_recurring(state: State<'_, Mutex<Connection>>, id: i64, payload: db::recurring::UpdateRecurring) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::recurring::update_recurring(&conn, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn process_recurrings(state: State<'_, Mutex<Connection>>) -> Result<i32, String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    db::recurring::process_due_recurrings(&mut conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn detect_suggestions(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::recurring::RecurringSuggestion>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::recurring::detect_suggestions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn ignore_subscription_suggestion(state: State<'_, Mutex<Connection>>, description: String) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::recurring::ignore_subscription(&conn, &description).map_err(|e| e.to_string())
}

// Backup
#[tauri::command]
fn export_db(app_handle: tauri::AppHandle, state: State<'_, Mutex<Connection>>, destination_path: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("budzet.db");
    
    let conn = state.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);").map_err(|e| e.to_string())?;
    
    std::fs::copy(&db_path, &destination_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn import_db(app_handle: tauri::AppHandle, state: State<'_, Mutex<Connection>>, source_path: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("budzet.db");

    // Zanim cokolwiek skasujemy: sprawdzamy, czy wskazany plik to w ogóle nasza baza.
    // Wcześniej wybranie przypadkowego pliku .db kasowało dane użytkownika bezpowrotnie.
    validate_backup_file(&source_path)?;

    let mut conn = state.lock().map_err(|e| e.to_string())?;

    // Kopia bezpieczeństwa obecnej bazy — punkt powrotu, gdyby import się wywalił.
    let rollback_path = app_dir.join("budzet.db.rollback");
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);").map_err(|e| e.to_string())?;
    std::fs::copy(&db_path, &rollback_path).map_err(|e| e.to_string())?;

    // Odłączamy się od starego pliku, przechodząc na chwilę do pamięci RAM, żeby odblokować uchwyt (lock) na pliku!
    *conn = Connection::open_in_memory().map_err(|e| e.to_string())?;

    // Usypiamy wątek na bardzo krótki czas, by system (np. Windows Defender) puścił blokadę
    std::thread::sleep(std::time::Duration::from_millis(150));

    // Usuwamy pliki tymczasowe SQLite (wal/shm), by nie skorumpować nadpisywanej bazy!
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(app_dir.join("budzet.db-wal"));
    let _ = std::fs::remove_file(app_dir.join("budzet.db-shm"));

    let restore = |conn: &mut Connection| {
        let _ = std::fs::copy(&rollback_path, &db_path);
        if let Ok(restored) = Connection::open(&db_path) {
            let _ = db::configure_connection(&restored);
            *conn = restored;
        }
    };

    // Kopiujemy plik z backupem
    if let Err(e) = std::fs::copy(&source_path, &db_path) {
        restore(&mut conn);
        return Err(format!("Nie udało się skopiować pliku kopii zapasowej: {}", e));
    }

    // Otwieramy bazę z powrotem na świeżym, odzyskanym pliku!
    let mut imported = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            restore(&mut conn);
            return Err(format!("Nie udało się otworzyć wgranej bazy: {}", e));
        }
    };

    // Kopia może pochodzić ze starszej wersji aplikacji — bez migracji schemat
    // pozostałby przestarzały i aplikacja wywalałaby się na brakujących kolumnach.
    if let Err(e) = db::configure_connection(&imported)
        .map_err(|e| e.to_string())
        .and_then(|_| db::migrations::run_migrations(&mut imported).map_err(|e| e.to_string()))
    {
        drop(imported);
        restore(&mut conn);
        return Err(format!("Wgrany plik nie jest poprawną kopią zapasową: {}", e));
    }

    *conn = imported;
    let _ = std::fs::remove_file(&rollback_path);

    Ok(())
}

/// Minimalna weryfikacja, że plik jest bazą SQLite zawierającą tabele tej aplikacji.
fn validate_backup_file(source_path: &str) -> Result<(), String> {
    let probe = Connection::open_with_flags(
        source_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .map_err(|_| "Wskazany plik nie jest bazą danych SQLite.".to_string())?;

    let has_tables: i64 = probe
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('accounts', 'transactions', 'categories')",
            [],
            |row| row.get(0),
        )
        .map_err(|_| "Wskazany plik nie jest bazą danych SQLite.".to_string())?;

    if has_tables < 3 {
        return Err("Wskazany plik nie jest kopią zapasową Domowego Budżetu.".to_string());
    }
    Ok(())
}

// Settings
#[tauri::command]
fn get_setting(state: State<'_, Mutex<Connection>>, key: &str) -> Result<Option<String>, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::settings::get_setting(&conn, key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_setting(state: State<'_, Mutex<Connection>>, key: &str, value: &str) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::settings::set_setting(&conn, key, value).map_err(|e| e.to_string())
}

#[tauri::command]
fn factory_reset(state: State<'_, Mutex<Connection>>) -> Result<(), String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    db::factory_reset(&mut conn).map_err(|e| e.to_string())
}

// Categories Management
#[tauri::command]
fn create_category(state: State<'_, Mutex<Connection>>, name: &str, type_: &str, color: Option<&str>) -> Result<i64, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::categories::create_category(&conn, name, type_, color).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_category(state: State<'_, Mutex<Connection>>, id: i64) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::categories::delete_category(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_category(state: State<'_, Mutex<Connection>>, id: i64, name: &str, type_: &str, color: Option<&str>) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::categories::update_category(&conn, id, name, type_, color).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
            let conn = db::init_db(app_dir).expect("failed to initialize db");
            
            // We can manage the connection as state later
            app.manage(std::sync::Mutex::new(conn));
            
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_accounts,
            create_account,
            delete_account,
            get_categories,
            get_transactions,
            get_transaction_months,
            get_dashboard_stats,
            get_transaction_by_id,
            get_budget_states,
            get_ready_to_assign,
            create_transaction,
            get_tags,
            upsert_budget,
            copy_budgets_to_month,
            get_goals,
            create_goal,
            delete_goal,
            add_to_goal,
            get_recurrings,
            create_recurring,
            delete_recurring,
            process_recurrings,
            detect_suggestions,
            ignore_subscription_suggestion,
            export_db,
            import_db,
            get_setting,
            set_setting,
            factory_reset,
            create_category,
            delete_category,
            update_category,
            bulk_insert_transactions,
            delete_transaction,
            update_transaction,
            update_account,
            update_goal,
            update_recurring
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
