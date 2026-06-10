use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
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

struct MonthlyData {
    assigned: f64,
    activity: f64,
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
    for row in rows {
        if let Ok((month, cat_id, amount)) = row {
            assigned_map.insert((month, cat_id), amount);
        }
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
        if let Ok((month, Some(cat_id), type_, amount)) = row {
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
                let prev_avail = states.get(prev).unwrap().get(&cat_id).unwrap().available;
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
            sum_available += state.available; // includes negative amounts!
        }
    }

    Ok(total_accounts - sum_available)
}
