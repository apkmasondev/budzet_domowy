pub mod db;
use tauri::{Manager, State};
use std::sync::Mutex;
use rusqlite::Connection;

#[tauri::command]
fn get_accounts(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::accounts::Account>, String> {
    let conn = state.lock().unwrap();
    db::accounts::get_accounts(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_account(state: State<'_, Mutex<Connection>>, payload: db::accounts::CreateAccountPayload) -> Result<i64, String> {
    let conn = state.lock().unwrap();
    db::accounts::create_account(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_account(state: State<'_, Mutex<Connection>>, id: i64) -> Result<(), String> {
    let conn = state.lock().unwrap();
    db::accounts::delete_account(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_categories(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::categories::Category>, String> {
    let conn = state.lock().unwrap();
    db::categories::get_categories(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_transaction(state: State<'_, Mutex<Connection>>, payload: db::transactions::CreateTransactionPayload) -> Result<i64, String> {
    let mut conn = state.lock().unwrap();
    db::transactions::create_transaction(&mut conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn bulk_insert_transactions(state: State<'_, Mutex<Connection>>, payloads: Vec<db::transactions::CreateTransactionPayload>) -> Result<usize, String> {
    let mut conn = state.lock().unwrap();
    db::transactions::bulk_insert_transactions(&mut conn, payloads).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_transactions(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::transactions::Transaction>, String> {
    let conn = state.lock().unwrap();
    db::transactions::get_transactions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_tags(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::tags::Tag>, String> {
    let conn = state.lock().unwrap();
    db::tags::get_all_tags(&conn).map_err(|e| e.to_string())
}

// Budgets
#[tauri::command]
fn get_budgets(state: State<'_, Mutex<Connection>>, month: &str) -> Result<Vec<db::budgets::Budget>, String> {
    let conn = state.lock().unwrap();
    db::budgets::get_budgets(&conn, month).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_budgets(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::budgets::Budget>, String> {
    let conn = state.lock().unwrap();
    db::budgets::get_all_budgets(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn upsert_budget(state: State<'_, Mutex<Connection>>, payload: db::budgets::UpsertBudgetPayload) -> Result<(), String> {
    let conn = state.lock().unwrap();
    db::budgets::upsert_budget(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_budgets_to_month(state: State<'_, Mutex<Connection>>, from_month: &str, to_month: &str) -> Result<(), String> {
    let conn = state.lock().unwrap();
    db::budgets::copy_budgets_to_month(&conn, from_month, to_month).map_err(|e| e.to_string())
}

// Goals
#[tauri::command]
fn get_goals(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::goals::Goal>, String> {
    let conn = state.lock().unwrap();
    db::goals::get_goals(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_goal(state: State<'_, Mutex<Connection>>, payload: db::goals::CreateGoalPayload) -> Result<i64, String> {
    let conn = state.lock().unwrap();
    db::goals::create_goal(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_goal(state: State<'_, Mutex<Connection>>, id: i64) -> Result<(), String> {
    let conn = state.lock().unwrap();
    db::goals::delete_goal(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_to_goal(state: State<'_, Mutex<Connection>>, payload: db::goals::AddToGoalPayload) -> Result<(), String> {
    let mut conn = state.lock().unwrap();
    db::goals::add_to_goal(&mut conn, payload).map_err(|e| e.to_string())
}

// Recurring
#[tauri::command]
fn get_recurrings(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::recurring::Recurring>, String> {
    let conn = state.lock().unwrap();
    db::recurring::get_recurrings(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_recurring(state: State<'_, Mutex<Connection>>, payload: db::recurring::CreateRecurring) -> Result<i32, String> {
    let conn = state.lock().unwrap();
    db::recurring::create_recurring(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_recurring(state: State<'_, Mutex<Connection>>, id: i32) -> Result<(), String> {
    let conn = state.lock().unwrap();
    db::recurring::delete_recurring(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn process_recurrings(state: State<'_, Mutex<Connection>>) -> Result<i32, String> {
    let mut conn = state.lock().unwrap();
    db::recurring::process_due_recurrings(&mut conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn detect_suggestions(state: State<'_, Mutex<Connection>>) -> Result<Vec<db::recurring::RecurringSuggestion>, String> {
    let conn = state.lock().unwrap();
    db::recurring::detect_suggestions(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn ignore_subscription_suggestion(state: State<'_, Mutex<Connection>>, description: String) -> Result<(), String> {
    let conn = state.lock().unwrap();
    let current_ignored = db::settings::get_setting(&conn, "ignored_subscriptions")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    
    let new_ignored = if current_ignored.is_empty() {
        description
    } else {
        format!("{},{}", current_ignored, description)
    };
    
    db::settings::set_setting(&conn, "ignored_subscriptions", &new_ignored).map_err(|e| e.to_string())
}

// Backup
#[tauri::command]
fn export_db(app_handle: tauri::AppHandle, destination_path: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("budzet.db");
    std::fs::copy(&db_path, &destination_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn import_db(app_handle: tauri::AppHandle, state: State<'_, Mutex<Connection>>, source_path: String) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("budzet.db");
    
    let mut conn = state.lock().unwrap();
    // Odłączamy się od starego pliku, przechodząc na chwilę do pamięci RAM, żeby odblokować uchwyt (lock) na pliku!
    *conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
    
    // Nadpisujemy stary plik z backupem (Dzięki in-memory connection Windows nie wyrzuci błędu File in use!)
    std::fs::copy(&source_path, &db_path).map_err(|e| e.to_string())?;
    
    // Otwieramy bazę z powrotem na świeżym, odzyskanym pliku!
    *conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    
    Ok(())
}

// Settings
#[tauri::command]
fn get_setting(state: State<'_, Mutex<Connection>>, key: &str) -> Result<Option<String>, String> {
    let conn = state.lock().unwrap();
    db::settings::get_setting(&conn, key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_setting(state: State<'_, Mutex<Connection>>, key: &str, value: &str) -> Result<(), String> {
    let conn = state.lock().unwrap();
    db::settings::set_setting(&conn, key, value).map_err(|e| e.to_string())
}

#[tauri::command]
fn factory_reset(state: State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = state.lock().unwrap();
    conn.execute_batch(
        "DELETE FROM transaction_tags;
         DELETE FROM tags;
         DELETE FROM transactions;
         DELETE FROM recurring;
         DELETE FROM budgets;
         DELETE FROM goals;
         DELETE FROM accounts;
         DELETE FROM app_settings;
         DELETE FROM categories;"
    ).map_err(|e| e.to_string())?;
    
    db::categories::seed_default_categories(&conn).map_err(|e| e.to_string())?;
    Ok(())
}

// Categories Management
#[tauri::command]
fn create_category(state: State<'_, Mutex<Connection>>, name: &str, type_: &str, color: Option<&str>) -> Result<i64, String> {
    let conn = state.lock().unwrap();
    db::categories::create_category(&conn, name, type_, color).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_category(state: State<'_, Mutex<Connection>>, id: i64) -> Result<(), String> {
    let conn = state.lock().unwrap();
    db::categories::delete_category(&conn, id).map_err(|e| e.to_string())
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_accounts,
            create_account,
            delete_account,
            get_categories,
            get_transactions,
            create_transaction,
            get_tags,
            get_budgets,
            get_all_budgets,
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
            bulk_insert_transactions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
