use rusqlite::{Connection, Result};
use serde::Serialize;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Serialize, Clone)]
pub struct CategoryState {
    pub category_id: i64,
    pub rollover: f64,
    pub assigned: f64,
    pub activity: f64,
    pub available: f64,
    pub overspent: f64,
}

pub fn calculate_zbb_states(conn: &Connection) -> Result<HashMap<String, HashMap<i64, CategoryState>>> {
    // 1. Get all expense categories
    let mut stmt = conn.prepare("SELECT id FROM categories WHERE type IN ('expense', 'both')")?;
    let cat_ids: Vec<i64> = stmt.query_map([], |row| row.get(0))?.collect::<Result<Vec<_>>>()?;

    // 2. Get all distinct months
    let mut months = HashSet::new();
    let current_month = chrono::Local::now().format("%Y-%m").to_string();
    months.insert(current_month);

    let mut stmt = conn.prepare("SELECT DISTINCT substr(date, 1, 7) FROM transactions WHERE type IN ('expense', 'income')")?;
    let tx_months: Vec<String> = stmt.query_map([], |row| row.get(0))?.collect::<Result<Vec<_>>>()?;
    for m in tx_months { months.insert(m); }

    let mut stmt = conn.prepare("SELECT DISTINCT month FROM budgets")?;
    let bd_months: Vec<String> = stmt.query_map([], |row| row.get(0))?.collect::<Result<Vec<_>>>()?;
    for m in bd_months { months.insert(m); }

    let mut sorted_months: Vec<String> = months.into_iter().collect();
    sorted_months.sort();

    // 3. Fetch all assigned (budgets)
    let mut assigned_map: HashMap<(String, i64), f64> = HashMap::new();
    let mut stmt = conn.prepare("SELECT month, category_id, amount FROM budgets")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, f64>(2)?))
    })?;
    // Błąd odczytu musi przerwać liczenie. Ciche pominięcie wiersza (`if let Ok`)
    // dawało budżet zaniżony o brakujący przydział, bez żadnego sygnału dla użytkownika.
    for row in rows {
        let (month, cat_id, amount) = row?;
        assigned_map.insert((month, cat_id), amount);
    }

    // 4. Fetch all activity (transactions)
    let mut activity_map: HashMap<(String, i64), f64> = HashMap::new();
    let mut stmt = conn.prepare("SELECT substr(date, 1, 7), category_id, type, amount FROM transactions WHERE type IN ('expense', 'income')")?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<i64>>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, f64>(3)?
        ))
    })?;
    for row in rows {
        // Transakcje bez kategorii (np. wpłaty na cele) świadomie nie wchodzą do ZBB,
        // ale błąd odczytu wiersza już tak — nie wolno go pomylić z brakiem kategorii.
        let (month, category_id, type_, amount) = row?;
        if let Some(cat_id) = category_id {
            let entry = activity_map.entry((month, cat_id)).or_insert(0.0);
            if type_ == "expense" {
                *entry += amount;
            } else if type_ == "income" {
                *entry -= amount;
            }
        }
    }

    // 5. Calculate sequentially
    let mut states: HashMap<String, HashMap<i64, CategoryState>> = HashMap::new();
    
    for (i, month) in sorted_months.iter().enumerate() {
        let prev_month = if i > 0 { Some(&sorted_months[i - 1]) } else { None };
        let mut month_states = HashMap::new();

        for &cat_id in &cat_ids {
            let mut overspent = 0.0;
            let rollover = if let Some(prev) = prev_month {
                let prev_avail = states.get(prev)
                    .and_then(|m| m.get(&cat_id))
                    .map(|s| s.available)
                    .unwrap_or(0.0);
                if prev_avail < 0.0 {
                    overspent = prev_avail;
                }
                if prev_avail > 0.0 { prev_avail } else { 0.0 }
            } else {
                0.0
            };

            let assigned = *assigned_map.get(&(month.clone(), cat_id)).unwrap_or(&0.0);
            let activity = *activity_map.get(&(month.clone(), cat_id)).unwrap_or(&0.0);
            let available = rollover + assigned - activity;

            month_states.insert(cat_id, CategoryState {
                category_id: cat_id,
                rollover,
                assigned,
                activity,
                available,
                overspent,
            });
        }
        states.insert(month.clone(), month_states);
    }

    Ok(states)
}

pub fn get_budget_states(conn: &Connection, target_month: &str) -> Result<Vec<CategoryState>> {
    let states = calculate_zbb_states(conn)?;
    if let Some(month_state) = states.get(target_month) {
        let mut vec: Vec<CategoryState> = month_state.values().cloned().collect();
        vec.sort_by_key(|c| c.category_id);
        Ok(vec)
    } else {
        Ok(Vec::new())
    }
}

pub fn get_ready_to_assign(conn: &Connection) -> Result<f64> {
    // 1. Total accounts
    let mut stmt = conn.prepare("SELECT SUM(balance) FROM accounts")?;
    let total_accounts: f64 = stmt.query_row([], |row| row.get(0)).unwrap_or(0.0);

    // 2. Sum available in latest month
    let states = calculate_zbb_states(conn)?;
    
    // Find the latest month
    let mut max_month = String::new();
    for k in states.keys() {
        if k > &max_month {
            max_month = k.clone();
        }
    }

    let mut sum_available = 0.0;
    if let Some(latest_state) = states.get(&max_month) {
        for state in latest_state.values() {
            if state.available > 0.0 {
                sum_available += state.available;
            }
        }
    }

    Ok(total_accounts - sum_available)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run_migrations(&mut conn).unwrap();
        crate::db::configure_connection(&conn).unwrap();
        conn.execute(
            "INSERT INTO accounts (id, name, type, currency, balance) VALUES (1, 'A', 'bank', 'PLN', 1000)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO categories (id, name, type) VALUES (1, 'Jedzenie', 'expense')",
            [],
        )
        .unwrap();
        conn
    }

    fn assign(conn: &Connection, month: &str, amount: f64) {
        conn.execute(
            "INSERT INTO budgets (category_id, month, amount) VALUES (1, ?1, ?2)",
            rusqlite::params![month, amount],
        )
        .unwrap();
    }

    fn spend(conn: &Connection, date: &str, amount: f64) {
        conn.execute(
            "INSERT INTO transactions (account_id, category_id, amount, type, date) VALUES (1, 1, ?1, 'expense', ?2)",
            rusqlite::params![amount, date],
        )
        .unwrap();
    }

    fn state_for(conn: &Connection, month: &str) -> CategoryState {
        get_budget_states(conn, month).unwrap().into_iter().next().unwrap()
    }

    /// Niewykorzystana nadwyżka przechodzi na kolejny miesiąc.
    #[test]
    fn test_positive_carry_over() {
        let conn = setup();
        assign(&conn, "2024-01", 500.0);
        spend(&conn, "2024-01-15", 200.0);
        assign(&conn, "2024-02", 500.0);

        let jan = state_for(&conn, "2024-01");
        assert_eq!(jan.assigned, 500.0);
        assert_eq!(jan.activity, 200.0);
        assert_eq!(jan.available, 300.0);

        let feb = state_for(&conn, "2024-02");
        assert_eq!(feb.rollover, 300.0);
        assert_eq!(feb.available, 800.0);
    }

    /// Debet NIE przechodzi na kolejny miesiąc (pokrywa go "Do Rozdysponowania"),
    /// ale musi zostać zaraportowany jako `overspent`.
    #[test]
    fn test_overspend_does_not_carry_but_is_reported() {
        let conn = setup();
        assign(&conn, "2024-01", 100.0);
        spend(&conn, "2024-01-15", 250.0);
        assign(&conn, "2024-02", 100.0);

        let jan = state_for(&conn, "2024-01");
        assert_eq!(jan.available, -150.0);

        let feb = state_for(&conn, "2024-02");
        assert_eq!(feb.rollover, 0.0);
        assert_eq!(feb.overspent, -150.0);
        assert_eq!(feb.available, 100.0);
    }

    /// Zwrot (income na kategorii wydatkowej) pomniejsza aktywność miesiąca.
    #[test]
    fn test_refund_reduces_activity() {
        let conn = setup();
        assign(&conn, "2024-01", 500.0);
        spend(&conn, "2024-01-10", 300.0);
        conn.execute(
            "INSERT INTO transactions (account_id, category_id, amount, type, date) VALUES (1, 1, 100, 'income', '2024-01-20')",
            [],
        )
        .unwrap();

        let jan = state_for(&conn, "2024-01");
        assert_eq!(jan.activity, 200.0);
        assert_eq!(jan.available, 300.0);
    }

    #[test]
    fn test_ready_to_assign_subtracts_assigned_money() {
        let conn = setup();
        // 1000 zł na koncie, 400 zł przypisane i nietknięte => 600 zł do rozdysponowania.
        let current = chrono::Local::now().format("%Y-%m").to_string();
        assign(&conn, &current, 400.0);
        assert!((get_ready_to_assign(&conn).unwrap() - 600.0).abs() < 0.001);
    }

    #[test]
    fn test_empty_database_is_all_zeros() {
        let conn = setup();
        let current = chrono::Local::now().format("%Y-%m").to_string();
        let state = state_for(&conn, &current);
        assert_eq!(state.assigned, 0.0);
        assert_eq!(state.activity, 0.0);
        assert_eq!(state.available, 0.0);
        assert_eq!(state.rollover, 0.0);
    }
}
