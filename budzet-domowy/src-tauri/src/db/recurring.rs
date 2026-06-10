use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Recurring {
    pub id: i32,
    pub name: String,
    pub amount: f64,
    pub category_id: Option<i32>,
    pub account_id: Option<i32>,
    pub frequency: String,
    pub next_date: String,
    pub day_of_month: Option<i32>,
    pub active: i32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateRecurring {
    pub name: String,
    pub amount: f64,
    pub category_id: Option<i32>,
    pub account_id: Option<i32>,
    pub frequency: String,
    pub next_date: String,
    pub day_of_month: Option<i32>,
}

pub fn get_recurrings(conn: &Connection) -> Result<Vec<Recurring>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, amount, category_id, account_id, frequency, next_date, day_of_month, active FROM recurring ORDER BY next_date ASC"
    )?;
    
    let recurrings = stmt.query_map([], |row| {
        Ok(Recurring {
            id: row.get(0)?,
            name: row.get(1)?,
            amount: row.get(2)?,
            category_id: row.get(3)?,
            account_id: row.get(4)?,
            frequency: row.get(5)?,
            next_date: row.get(6)?,
            day_of_month: row.get(7)?,
            active: row.get(8)?,
        })
    })?.collect::<Result<Vec<_>>>()?;
    
    Ok(recurrings)
}

pub fn create_recurring(conn: &Connection, recurring: CreateRecurring) -> Result<i32> {
    conn.execute(
        "INSERT INTO recurring (name, amount, category_id, account_id, frequency, next_date, day_of_month) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![recurring.name, recurring.amount, recurring.category_id, recurring.account_id, recurring.frequency, recurring.next_date, recurring.day_of_month],
    )?;
    Ok(conn.last_insert_rowid() as i32)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateRecurring {
    pub name: String,
    pub amount: f64,
    pub category_id: Option<i32>,
    pub account_id: Option<i32>,
    pub frequency: String,
    pub next_date: String,
    pub day_of_month: Option<i32>,
}

pub fn update_recurring(conn: &Connection, id: i32, payload: UpdateRecurring) -> Result<()> {
    conn.execute(
        "UPDATE recurring SET name = ?1, amount = ?2, category_id = ?3, account_id = ?4, frequency = ?5, next_date = ?6, day_of_month = ?7 WHERE id = ?8",
        params![payload.name, payload.amount, payload.category_id, payload.account_id, payload.frequency, payload.next_date, payload.day_of_month, id],
    )?;
    Ok(())
}

pub fn delete_recurring(conn: &Connection, id: i32) -> Result<()> {
    conn.execute("DELETE FROM recurring WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn process_due_recurrings(conn: &mut Connection) -> Result<i32> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    
    // Pobierz płatności z przeterminowaną lub dzisiejszą datą
    let mut stmt = conn.prepare("SELECT id, name, amount, category_id, account_id, frequency, next_date, day_of_month FROM recurring WHERE next_date <= ?1 AND active = 1")?;
    let due_recurrings: Vec<Recurring> = stmt.query_map(params![today], |row| {
        Ok(Recurring {
            id: row.get(0)?,
            name: row.get(1)?,
            amount: row.get(2)?,
            category_id: row.get(3)?,
            account_id: row.get(4)?,
            frequency: row.get(5)?,
            next_date: row.get(6)?,
            day_of_month: row.get(7)?,
            active: 1,
        })
    })?.collect::<Result<Vec<_>>>()?;
    drop(stmt);

    let mut processed_count = 0;

    let tx = conn.transaction()?;

    for recurring in due_recurrings {
        use chrono::Datelike;
        
        let desc = format!("{} (Autopłatność)", recurring.name);
        
        tx.execute(
            "INSERT INTO transactions (account_id, category_id, amount, type, description, date) VALUES (?1, ?2, ?3, 'expense', ?4, ?5)",
            params![recurring.account_id, recurring.category_id, recurring.amount, desc, recurring.next_date],
        )?;

        if let Some(acc_id) = recurring.account_id {
            tx.execute(
                "UPDATE accounts SET balance = balance - ?1 WHERE id = ?2",
                params![recurring.amount, acc_id],
            )?;
        }

        let next_date_str = recurring.next_date.as_str();
        let mut new_date_str = next_date_str.to_string();
        if let Ok(parsed_date) = chrono::NaiveDate::parse_from_str(next_date_str, "%Y-%m-%d") {
            let next_month = if parsed_date.month() == 12 {
                chrono::NaiveDate::from_ymd_opt(parsed_date.year() + 1, 1, recurring.day_of_month.unwrap_or(parsed_date.day() as i32) as u32)
            } else {
                chrono::NaiveDate::from_ymd_opt(parsed_date.year(), parsed_date.month() + 1, recurring.day_of_month.unwrap_or(parsed_date.day() as i32) as u32)
            };
            
            let valid_date = next_month.unwrap_or_else(|| chrono::NaiveDate::from_ymd_opt(
                if parsed_date.month() == 12 { parsed_date.year() + 1 } else { parsed_date.year() },
                if parsed_date.month() == 12 { 1 } else { parsed_date.month() + 1 },
                28
            ).unwrap());
            new_date_str = valid_date.format("%Y-%m-%d").to_string();
        }
        
        tx.execute("UPDATE recurring SET next_date = ?1 WHERE id = ?2", params![new_date_str, recurring.id])?;
        processed_count += 1;
    }

    tx.commit()?;
    Ok(processed_count)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RecurringSuggestion {
    pub description: String,
    pub amount: f64,
    pub category_id: Option<i32>,
    pub account_id: i32,
    pub last_date: String,
}

pub fn detect_suggestions(conn: &Connection) -> Result<Vec<RecurringSuggestion>> {
    use std::collections::HashMap;
    use chrono::{NaiveDate, Utc, Duration};
    
    // 1. Get ignored subscriptions
    let ignored_str = super::settings::get_setting(conn, "ignored_subscriptions")?.unwrap_or_default();
    let ignored: Vec<String> = ignored_str.split(',').map(|s| s.trim().to_lowercase()).collect();
    
    // 2. Get existing recurrings to ignore their names
    let recurrings = get_recurrings(conn)?;
    let mut existing_names: Vec<String> = recurrings.into_iter().map(|r| r.name.to_lowercase()).collect();
    existing_names.extend(ignored);

    // 3. Get expenses from the last 90 days
    let ninety_days_ago = (Utc::now() - Duration::days(90)).format("%Y-%m-%d").to_string();
    let mut stmt = conn.prepare(
        "SELECT description, amount, category_id, account_id, date 
         FROM transactions 
         WHERE type = 'expense' AND date >= ?1 AND description IS NOT NULL AND description != ''"
    )?;
    
    struct Tx {
        amount: f64,
        category_id: Option<i32>,
        account_id: i32,
        date: String,
    }
    
    let mut groups: HashMap<String, Vec<Tx>> = HashMap::new();
    
    let rows = stmt.query_map(params![ninety_days_ago], |row| {
        let desc: String = row.get(0)?;
        Ok((desc, Tx {
            amount: row.get(1)?,
            category_id: row.get(2)?,
            account_id: row.get(3)?,
            date: row.get(4)?,
        }))
    })?;
    
    for row in rows {
        if let Ok((desc, tx)) = row {
            let lower_desc = desc.to_lowercase();
            if !existing_names.contains(&lower_desc) {
                groups.entry(desc).or_default().push(tx);
            }
        }
    }
    
    let mut suggestions = Vec::new();
    
    // 4. Analyze groups
    for (desc, mut txs) in groups {
        if txs.len() < 3 { continue; } // Require at least 3 occurrences
        
        // Calculate average amount
        let sum: f64 = txs.iter().map(|t| t.amount).sum();
        let avg_amount = sum / txs.len() as f64;
        
        // Check amount variance (must be within ~10% of the average)
        let mut is_stable_amount = true;
        for t in &txs {
            let diff = (t.amount - avg_amount).abs();
            if diff > avg_amount * 0.10 {
                is_stable_amount = false;
                break;
            }
        }
        
        if !is_stable_amount { continue; }
        
        // Check dates
        txs.sort_by(|a, b| a.date.cmp(&b.date));
        
        let mut total_days = 0;
        let mut intervals = 0;
        
        for i in 1..txs.len() {
            if let (Ok(d1), Ok(d2)) = (NaiveDate::parse_from_str(&txs[i-1].date, "%Y-%m-%d"), NaiveDate::parse_from_str(&txs[i].date, "%Y-%m-%d")) {
                let diff = (d2 - d1).num_days();
                // If there are multiple transactions in the same day or very close, skip interval calculation
                if diff > 5 {
                    total_days += diff;
                    intervals += 1;
                }
            }
        }
        
        if intervals >= 2 {
            let avg_interval = total_days / intervals;
            // Monthly subscription usually has an interval of 28-31 days
            // We allow 25-35 days to be safe
            if avg_interval >= 25 && avg_interval <= 35 {
                let last_tx = txs.last().unwrap();
                suggestions.push(RecurringSuggestion {
                    description: desc,
                    amount: avg_amount,
                    category_id: last_tx.category_id,
                    account_id: last_tx.account_id,
                    last_date: last_tx.date.clone(),
                });
            }
        }
    }
    
    Ok(suggestions)
}
