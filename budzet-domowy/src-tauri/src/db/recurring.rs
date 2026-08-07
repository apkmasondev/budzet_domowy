use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Recurring {
    pub id: i64,
    pub name: String,
    pub amount: f64,
    pub category_id: Option<i64>,
    pub account_id: Option<i64>,
    pub frequency: String,
    pub next_date: String,
    pub day_of_month: Option<i32>,
    pub active: i32,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateRecurring {
    pub name: String,
    pub amount: f64,
    pub category_id: Option<i64>,
    pub account_id: Option<i64>,
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

pub const FREQUENCIES: [&str; 4] = ["weekly", "monthly", "quarterly", "yearly"];

fn validate_recurring(amount: f64, frequency: &str, next_date: &str, day_of_month: Option<i32>) -> Result<()> {
    if !amount.is_finite() || amount <= 0.0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Kwota subskrypcji musi być większa od zera".to_string(),
        ));
    }
    if !FREQUENCIES.contains(&frequency) {
        return Err(rusqlite::Error::InvalidParameterName(
            "Nieobsługiwana częstotliwość płatności".to_string(),
        ));
    }
    if chrono::NaiveDate::parse_from_str(next_date, "%Y-%m-%d").is_err() {
        return Err(rusqlite::Error::InvalidParameterName(
            "Data płatności musi być w formacie RRRR-MM-DD".to_string(),
        ));
    }
    if let Some(day) = day_of_month {
        if !(1..=31).contains(&day) {
            return Err(rusqlite::Error::InvalidParameterName(
                "Dzień rozliczenia musi mieścić się w zakresie 1-31".to_string(),
            ));
        }
    }
    Ok(())
}

pub fn create_recurring(conn: &Connection, recurring: CreateRecurring) -> Result<i64> {
    validate_recurring(recurring.amount, &recurring.frequency, &recurring.next_date, recurring.day_of_month)?;
    conn.execute(
        "INSERT INTO recurring (name, amount, category_id, account_id, frequency, next_date, day_of_month) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![recurring.name, recurring.amount, recurring.category_id, recurring.account_id, recurring.frequency, recurring.next_date, recurring.day_of_month],
    )?;
    Ok(conn.last_insert_rowid())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateRecurring {
    pub name: String,
    pub amount: f64,
    pub category_id: Option<i64>,
    pub account_id: Option<i64>,
    pub frequency: String,
    pub next_date: String,
    pub day_of_month: Option<i32>,
}

pub fn update_recurring(conn: &Connection, id: i64, payload: UpdateRecurring) -> Result<()> {
    validate_recurring(payload.amount, &payload.frequency, &payload.next_date, payload.day_of_month)?;
    conn.execute(
        "UPDATE recurring SET name = ?1, amount = ?2, category_id = ?3, account_id = ?4, frequency = ?5, next_date = ?6, day_of_month = ?7 WHERE id = ?8",
        params![payload.name, payload.amount, payload.category_id, payload.account_id, payload.frequency, payload.next_date, payload.day_of_month, id],
    )?;
    Ok(())
}

pub fn delete_recurring(conn: &Connection, id: i64) -> Result<()> {
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
        let mut current_next_date = recurring.next_date.clone();

        // Twardy limit iteracji: chroni przed zapętleniem, gdyby data z bazy okazała się
        // niemożliwa do przesunięcia (np. uszkodzony rekord po ręcznej edycji pliku .db).
        let mut guard = 0;

        while current_next_date <= today && guard < MAX_CATCHUP_ITERATIONS {
            guard += 1;

            let parsed_date = match chrono::NaiveDate::parse_from_str(&current_next_date, "%Y-%m-%d") {
                Ok(d) => d,
                // Niepoprawna data => nie księgujemy niczego i zostawiamy rekord bez zmian.
                Err(_) => break,
            };

            let desc = format!("{} (Autopłatność)", recurring.name);

            tx.execute(
                "INSERT INTO transactions (account_id, category_id, amount, type, description, date) VALUES (?1, ?2, ?3, 'expense', ?4, ?5)",
                params![recurring.account_id, recurring.category_id, recurring.amount, desc, current_next_date],
            )?;

            if let Some(acc_id) = recurring.account_id {
                tx.execute(
                    "UPDATE accounts SET balance = balance - ?1 WHERE id = ?2",
                    params![recurring.amount, acc_id],
                )?;
            }

            // Licznik inkrementowany zaraz po zaksięgowaniu — wcześniej stał za `break`
            // i przy błędzie parsowania daty gubił już wykonaną wpłatę.
            processed_count += 1;

            current_next_date = advance_date(parsed_date, &recurring.frequency, recurring.day_of_month)
                .format("%Y-%m-%d")
                .to_string();
        }

        tx.execute("UPDATE recurring SET next_date = ?1 WHERE id = ?2", params![current_next_date, recurring.id])?;
    }

    tx.commit()?;
    Ok(processed_count)
}

/// Maksymalna liczba zaległych płatności nadrabianych jednorazowo dla jednej subskrypcji
/// (ok. 10 lat płatności tygodniowych).
const MAX_CATCHUP_ITERATIONS: i32 = 520;

/// Przesuwa datę o jeden okres zgodnie z `frequency`.
/// Wcześniej pole `frequency` było całkowicie ignorowane — każda subskrypcja,
/// niezależnie od ustawienia, księgowała się co miesiąc.
fn advance_date(from: chrono::NaiveDate, frequency: &str, day_of_month: Option<i32>) -> chrono::NaiveDate {
    match frequency {
        "weekly" => from + chrono::Duration::days(7),
        "quarterly" => add_months(from, 3, day_of_month),
        "yearly" => add_months(from, 12, day_of_month),
        // "monthly" oraz wszystko nieznane (dane sprzed walidacji) traktujemy miesięcznie.
        _ => add_months(from, 1, day_of_month),
    }
    .max(from + chrono::Duration::days(1))
}

/// Dodaje `months` miesięcy zachowując preferowany dzień rozliczenia.
/// Jeśli docelowy miesiąc jest krótszy (np. 31 lutego), przycinamy do ostatniego dnia
/// tego miesiąca zamiast — jak wcześniej — twardego 28.
fn add_months(from: chrono::NaiveDate, months: u32, day_of_month: Option<i32>) -> chrono::NaiveDate {
    use chrono::Datelike;

    let total = from.year() * 12 + (from.month() as i32 - 1) + months as i32;
    let year = total.div_euclid(12);
    let month = total.rem_euclid(12) as u32 + 1;

    let preferred = day_of_month.unwrap_or(from.day() as i32).clamp(1, 31) as u32;
    let last_day = days_in_month(year, month);

    chrono::NaiveDate::from_ymd_opt(year, month, preferred.min(last_day))
        .unwrap_or(from)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    use chrono::Datelike;
    let (next_year, next_month) = if month == 12 { (year + 1, 1) } else { (year, month + 1) };
    chrono::NaiveDate::from_ymd_opt(next_year, next_month, 1)
        .and_then(|d| d.pred_opt())
        .map(|d| d.day())
        .unwrap_or(28)
}

pub fn get_ignored_subscriptions(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT description FROM ignored_subscriptions")?;
    let rows = stmt.query_map([], |row| row.get(0))?.collect();
    rows
}

pub fn ignore_subscription(conn: &Connection, description: &str) -> Result<()> {
    let description = description.trim();
    if description.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName(
            "Pusty opis subskrypcji".to_string(),
        ));
    }
    conn.execute(
        "INSERT OR IGNORE INTO ignored_subscriptions (description) VALUES (?1)",
        params![description],
    )?;
    Ok(())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RecurringSuggestion {
    pub description: String,
    pub amount: f64,
    pub category_id: Option<i64>,
    pub account_id: i64,
    pub last_date: String,
}

pub fn detect_suggestions(conn: &Connection) -> Result<Vec<RecurringSuggestion>> {
    use std::collections::HashMap;
    use chrono::{NaiveDate, Utc, Duration};
    
    // 1. Get ignored suggestions (własna tabela — opisy z banku zawierają przecinki)
    let ignored = get_ignored_subscriptions(conn)?;

    // 2. Get existing recurrings to ignore their names
    let recurrings = get_recurrings(conn)?;
    let mut existing_names: std::collections::HashSet<String> =
        recurrings.into_iter().map(|r| r.name.trim().to_lowercase()).collect();
    existing_names.extend(ignored.into_iter().map(|s| s.trim().to_lowercase()));

    // 3. Get expenses from the last 90 days
    let ninety_days_ago = (Utc::now() - Duration::days(90)).format("%Y-%m-%d").to_string();
    let mut stmt = conn.prepare(
        "SELECT description, amount, category_id, account_id, date 
         FROM transactions 
         WHERE type = 'expense' AND date >= ?1 AND description IS NOT NULL AND description != ''"
    )?;
    
    struct Tx {
        amount: f64,
        category_id: Option<i64>,
        account_id: i64,
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
        let (desc, tx) = row?;
        if !existing_names.contains(&desc.trim().to_lowercase()) {
            groups.entry(desc).or_default().push(tx);
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
            if (25..=35).contains(&avg_interval) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn date(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn test_frequency_is_respected() {
        assert_eq!(advance_date(date("2024-03-10"), "weekly", Some(10)), date("2024-03-17"));
        assert_eq!(advance_date(date("2024-03-10"), "monthly", Some(10)), date("2024-04-10"));
        assert_eq!(advance_date(date("2024-03-10"), "quarterly", Some(10)), date("2024-06-10"));
        assert_eq!(advance_date(date("2024-03-10"), "yearly", Some(10)), date("2025-03-10"));
    }

    /// Dzień 31 w krótszym miesiącu przycinamy do ostatniego dnia, a nie na sztywno do 28.
    #[test]
    fn test_day_of_month_clamped_to_month_length() {
        assert_eq!(advance_date(date("2024-01-31"), "monthly", Some(31)), date("2024-02-29")); // rok przestępny
        assert_eq!(advance_date(date("2023-01-31"), "monthly", Some(31)), date("2023-02-28"));
        assert_eq!(advance_date(date("2024-04-30"), "monthly", Some(31)), date("2024-05-31"));
    }

    #[test]
    fn test_year_rollover() {
        assert_eq!(advance_date(date("2024-12-15"), "monthly", Some(15)), date("2025-01-15"));
        assert_eq!(advance_date(date("2024-11-15"), "quarterly", Some(15)), date("2025-02-15"));
    }

    /// Data zawsze musi iść do przodu — inaczej pętla nadrabiania zaległości
    /// zablokowałaby aplikację przy starcie.
    #[test]
    fn test_advance_always_moves_forward() {
        for freq in ["weekly", "monthly", "quarterly", "yearly", "nieznana"] {
            let from = date("2024-02-29");
            assert!(advance_date(from, freq, Some(29)) > from, "freq={}", freq);
        }
    }

    #[test]
    fn test_validation_rejects_bad_input() {
        assert!(validate_recurring(-5.0, "monthly", "2024-01-01", Some(1)).is_err());
        assert!(validate_recurring(0.0, "monthly", "2024-01-01", Some(1)).is_err());
        assert!(validate_recurring(10.0, "codziennie", "2024-01-01", Some(1)).is_err());
        assert!(validate_recurring(10.0, "monthly", "01-01-2024", Some(1)).is_err());
        assert!(validate_recurring(10.0, "monthly", "2024-01-01", Some(0)).is_err());
        assert!(validate_recurring(10.0, "monthly", "2024-01-01", Some(32)).is_err());
        assert!(validate_recurring(10.0, "monthly", "2024-01-01", Some(28)).is_ok());
    }
}
