use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use crate::db::tags;

#[derive(Debug, Serialize, Deserialize)]
pub struct Transaction {
    pub id: i64,
    pub account_id: i64,
    pub category_id: Option<i64>,
    pub amount: f64,
    #[serde(rename = "type")]
    pub type_: String,
    pub description: Option<String>,
    pub date: String,
    pub transfer_to_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct CreateTransactionPayload {
    pub account_id: i64,
    pub category_id: Option<i64>,
    pub amount: f64,
    #[serde(rename = "type")]
    pub type_: String,
    pub description: Option<String>,
    pub date: String,
    pub transfer_to_id: Option<i64>,
    pub tags: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct UpdateTransactionPayload {
    pub account_id: i64,
    pub category_id: Option<i64>,
    pub amount: f64,
    #[serde(rename = "type")]
    pub type_: String,
    pub description: Option<String>,
    pub date: String,
    pub transfer_to_id: Option<i64>,
    pub tags: Option<Vec<String>>,
}

/// Wspólna walidacja dla tworzenia i edycji transakcji.
/// Wcześniej rozjeżdżała się między `create`, `update` i `bulk_insert`.
fn validate_transaction(
    amount: f64,
    type_: &str,
    account_id: i64,
    transfer_to_id: Option<i64>,
) -> Result<()> {
    if !amount.is_finite() || amount <= 0.0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Kwota musi być liczbą większą od zera".to_string(),
        ));
    }
    if type_ != "income" && type_ != "expense" && type_ != "transfer" {
        return Err(rusqlite::Error::InvalidParameterName(
            "Nieprawidłowy typ transakcji".to_string(),
        ));
    }
    if type_ == "transfer" {
        match transfer_to_id {
            None => {
                return Err(rusqlite::Error::InvalidParameterName(
                    "Przelew wymaga wskazania konta docelowego".to_string(),
                ))
            }
            Some(target) if target == account_id => {
                return Err(rusqlite::Error::InvalidParameterName(
                    "Nie można wykonać przelewu na to samo konto".to_string(),
                ))
            }
            _ => {}
        }
    }
    Ok(())
}

pub fn create_transaction(conn: &mut Connection, payload: CreateTransactionPayload) -> Result<i64> {
    validate_transaction(
        payload.amount,
        &payload.type_,
        payload.account_id,
        payload.transfer_to_id,
    )?;

    let tx = conn.transaction()?;

    tx.execute(
        "INSERT INTO transactions (account_id, category_id, amount, type, description, date, transfer_to_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            payload.account_id,
            payload.category_id,
            payload.amount,
            payload.type_,
            payload.description,
            payload.date,
            payload.transfer_to_id
        ],
    )?;
    
    let last_id = tx.last_insert_rowid();

    // Dodawanie tagów, jeśli jakieś zostały przekazane
    if let Some(tags_list) = payload.tags {
        for tag_name in tags_list {
            let tag_name = tag_name.trim();
            if !tag_name.is_empty() {
                // Utwórz lub znajdź tag
                let tag_id = tags::create_tag(&tx, tag_name, None)?;
                tags::add_tag_to_transaction(&tx, last_id, tag_id)?;
            }
        }
    }

    // Zaktualizuj saldo konta z uzyciem transakcji (rollback jesli bladz)
    if payload.type_ == "income" {
        tx.execute("UPDATE accounts SET balance = balance + ?1 WHERE id = ?2", params![payload.amount, payload.account_id])?;
    } else if payload.type_ == "expense" {
        tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![payload.amount, payload.account_id])?;
    } else if payload.type_ == "transfer" {
        if let Some(transfer_to) = payload.transfer_to_id {
            tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![payload.amount, payload.account_id])?;
            tx.execute("UPDATE accounts SET balance = balance + ?1 WHERE id = ?2", params![payload.amount, transfer_to])?;
        }
    }

    tx.commit()?;
    Ok(last_id)
}

/// Tagi sklejane są przez GROUP_CONCAT separatorem US (0x1F), a nie przecinkiem —
/// przecinek jest legalnym znakiem w nazwie tagu i rozbijał ją na dwa tagi.
fn split_tags(joined: String) -> Vec<String> {
    joined
        .split('\u{1f}')
        .filter(|t| !t.is_empty())
        .map(|t| t.to_string())
        .collect()
}

// Lista argumentów odzwierciedla 1:1 parametry komendy Tauri, która musi mieć płaskie,
// nazwane pola (tak działa deserializacja IPC). Opakowanie ich w strukturę wymusiłoby
// duplikowanie tych samych pól po obu stronach granicy — świadomie zostawiamy płasko.
#[allow(clippy::too_many_arguments)]
pub fn get_transactions(
    conn: &Connection,
    limit: u32, 
    offset: u32,
    search: Option<String>,
    month: Option<String>,
    tx_type: Option<String>,
    sort_by: Option<String>,
    account_id: Option<i64>
) -> Result<Vec<Transaction>> {
    let mut query = "
        SELECT t.id, t.account_id, t.category_id, t.amount, t.type, t.description, t.date, t.transfer_to_id, t.created_at, t.updated_at,
               GROUP_CONCAT(tg.name, char(31)) as tags_str
        FROM transactions t
        LEFT JOIN transaction_tags tt ON t.id = tt.transaction_id
        LEFT JOIN tags tg ON tt.tag_id = tg.id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE 1=1
    ".to_string();

    let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(s) = search {
        if !s.trim().is_empty() {
            let s_trim = s.trim();
            if let Some(tag) = s_trim.strip_prefix('#') {
                let tag_search = tag.to_lowercase();
                query.push_str(" AND EXISTS (SELECT 1 FROM transaction_tags tt2 JOIN tags tg2 ON tt2.tag_id = tg2.id WHERE tt2.transaction_id = t.id AND LOWER(tg2.name) LIKE ?) ");
                args.push(Box::new(format!("%{}%", tag_search)));
            } else {
                query.push_str(" AND (LOWER(t.description) LIKE ? OR LOWER(c.name) LIKE ? OR CAST(t.amount AS TEXT) LIKE ? OR EXISTS (SELECT 1 FROM transaction_tags tt2 JOIN tags tg2 ON tt2.tag_id = tg2.id WHERE tt2.transaction_id = t.id AND LOWER(tg2.name) LIKE ?)) ");
                let search_pattern = format!("%{}%", s_trim.to_lowercase());
                args.push(Box::new(search_pattern.clone()));
                args.push(Box::new(search_pattern.clone()));
                args.push(Box::new(search_pattern.clone()));
                args.push(Box::new(search_pattern));
            }
        }
    }

    if let Some(m) = month {
        if !m.is_empty() {
            query.push_str(" AND t.date LIKE ? ");
            args.push(Box::new(format!("{}%", m)));
        }
    }

    if let Some(t) = tx_type {
        if !t.is_empty() && t != "all" {
            query.push_str(" AND t.type = ? ");
            args.push(Box::new(t));
        }
    }

    if let Some(acc_id) = account_id {
        query.push_str(" AND (t.account_id = ? OR t.transfer_to_id = ?) ");
        args.push(Box::new(acc_id));
        args.push(Box::new(acc_id));
    }

    query.push_str(" GROUP BY t.id ");

    let order_clause = match sort_by.as_deref() {
        Some("date_asc") => " ORDER BY t.date ASC, t.id ASC ",
        Some("amount_desc") => " ORDER BY t.amount DESC, t.id DESC ",
        Some("amount_asc") => " ORDER BY t.amount ASC, t.id ASC ",
        _ => " ORDER BY t.date DESC, t.id DESC ",
    };
    query.push_str(order_clause);

    query.push_str(" LIMIT ? OFFSET ? ");
    args.push(Box::new(limit));
    args.push(Box::new(offset));

    let mut stmt = conn.prepare(&query)?;
    
    let params_refs: Vec<&dyn rusqlite::ToSql> = args.iter().map(|arg| arg.as_ref()).collect();

    let iter = stmt.query_map(rusqlite::params_from_iter(params_refs), |row| {
        let id: i64 = row.get(0)?;
        let tags_str: Option<String> = row.get(10)?;
        let tags = tags_str.map(split_tags);

        Ok(Transaction {
            id,
            account_id: row.get(1)?,
            category_id: row.get(2)?,
            amount: row.get(3)?,
            type_: row.get(4)?,
            description: row.get(5)?,
            date: row.get(6)?,
            transfer_to_id: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
            tags,
        })
    })?;

    let mut transactions = Vec::new();
    for item in iter {
        transactions.push(item?);
    }

    Ok(transactions)
}

pub fn get_transaction_months(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT DISTINCT substr(date, 1, 7) FROM transactions ORDER BY 1 DESC")?;
    let iter = stmt.query_map([], |row| row.get(0))?;
    let mut months = Vec::new();
    for m in iter {
        months.push(m?);
    }
    Ok(months)
}

#[derive(serde::Serialize)]
pub struct DashboardStats {
    pub expenses: f64,
    pub incomes: f64,
    pub recent_transactions: Vec<Transaction>,
}

pub fn get_dashboard_stats(conn: &Connection, month: &str) -> Result<DashboardStats> {
    let mut expenses = 0.0;
    let mut incomes = 0.0;
    
    let mut stmt = conn.prepare("SELECT type, amount FROM transactions WHERE date LIKE ?")?;
    let month_param = format!("{}%", month);
    let iter = stmt.query_map(params![month_param], |row| {
        let t: String = row.get(0)?;
        let a: f64 = row.get(1)?;
        Ok((t, a))
    })?;
    
    for item in iter {
        // Błąd odczytu wiersza musi wybić się na górę — wcześniej `if let Ok(..)`
        // po cichu gubił wiersze i pokazywał zaniżone sumy na Dashboardzie.
        let (t, a) = item?;
        if t == "expense" {
            expenses += a;
        } else if t == "income" {
            incomes += a;
        }
    }
    
    let recent_transactions = get_transactions(conn, 5, 0, None, None, None, None, None)?;
    
    Ok(DashboardStats {
        expenses,
        incomes,
        recent_transactions
    })
}

pub fn bulk_insert_transactions(conn: &mut Connection, payloads: Vec<CreateTransactionPayload>) -> Result<usize> {
    let tx = conn.transaction()?;
    let mut count = 0;

    let mut existing_hashes = std::collections::HashSet::new();
    if !payloads.is_empty() {
        let mut account_ids: Vec<String> = payloads.iter().map(|p| p.account_id.to_string()).collect();
        account_ids.sort();
        account_ids.dedup();
        
        let in_clause = account_ids.join(",");
        let query = format!("SELECT date, amount, description, account_id FROM transactions WHERE account_id IN ({})", in_clause);
        let mut stmt = tx.prepare(&query)?;
        
        let iter = stmt.query_map([], |row| {
            let date: String = row.get(0)?;
            let amount: f64 = row.get(1)?;
            let desc: Option<String> = row.get(2)?;
            let account_id: i64 = row.get(3)?;
            let desc_str = desc.unwrap_or_default();
            Ok(format!("{}|{:.2}|{}|{}", date, amount, desc_str, account_id))
        })?;
        
        for item in iter {
            existing_hashes.insert(item?);
        }
    }

    for payload in payloads {
        validate_transaction(
            payload.amount,
            &payload.type_,
            payload.account_id,
            payload.transfer_to_id,
        )?;

        let desc_str = payload.description.as_deref().unwrap_or("");
        let hash = format!("{}|{:.2}|{}|{}", payload.date, payload.amount, desc_str, payload.account_id);
        
        if existing_hashes.contains(&hash) {
            continue; // Pomijamy duplikaty
        }
        existing_hashes.insert(hash);

        tx.execute(
            "INSERT INTO transactions (account_id, category_id, amount, type, description, date, transfer_to_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                payload.account_id,
                payload.category_id,
                payload.amount,
                payload.type_,
                payload.description,
                payload.date,
                payload.transfer_to_id
            ],
        )?;
        
        let last_id = tx.last_insert_rowid();

        if let Some(tags_list) = payload.tags {
            for tag_name in tags_list {
                let tag_name = tag_name.trim();
                if !tag_name.is_empty() {
                    let tag_id = tags::create_tag(&tx, tag_name, None)?;
                    tags::add_tag_to_transaction(&tx, last_id, tag_id)?;
                }
            }
        }

        if payload.type_ == "income" {
            tx.execute("UPDATE accounts SET balance = balance + ?1 WHERE id = ?2", params![payload.amount, payload.account_id])?;
        } else if payload.type_ == "expense" {
            tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![payload.amount, payload.account_id])?;
        } else if payload.type_ == "transfer" {
            if let Some(transfer_to) = payload.transfer_to_id {
                tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![payload.amount, payload.account_id])?;
                tx.execute("UPDATE accounts SET balance = balance + ?1 WHERE id = ?2", params![payload.amount, transfer_to])?;
            }
        }
        count += 1;
    }

    tx.commit()?;
    Ok(count)
}

pub fn delete_transaction(conn: &mut Connection, id: i64) -> Result<()> {
    let tx = conn.transaction()?;

    let (account_id, amount, type_, transfer_to_id, goal_id) = {
        let mut stmt = tx.prepare("SELECT account_id, amount, type, transfer_to_id, goal_id FROM transactions WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            (
                row.get::<_, i64>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<i64>>(4)?,
            )
        } else {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
    };

    // Revert balance
    if type_ == "income" {
        tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![amount, account_id])?;
    } else if type_ == "expense" {
        tx.execute("UPDATE accounts SET balance = balance + ?1 WHERE id = ?2", params![amount, account_id])?;
    } else if type_ == "transfer" {
        if let Some(transfer_to) = transfer_to_id {
            tx.execute("UPDATE accounts SET balance = balance + ?1 WHERE id = ?2", params![amount, account_id])?;
            tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![amount, transfer_to])?;
        }
    }

    // Wpłata na cel jest zawsze typu 'expense'. Zwracamy środki celowi tylko wtedy,
    // gdy transakcja faktycznie je do niego wniosła.
    if let (Some(gid), "expense") = (goal_id, type_.as_str()) {
        tx.execute("UPDATE goals SET current_amount = current_amount - ?1 WHERE id = ?2", params![amount, gid])?;
    }
    tx.execute("DELETE FROM transaction_tags WHERE transaction_id = ?1", params![id])?;
    tx.execute("DELETE FROM transactions WHERE id = ?1", params![id])?;
    tags::prune_orphan_tags(&tx)?;

    tx.commit()?;
    Ok(())
}

pub fn update_transaction(conn: &mut Connection, id: i64, payload: UpdateTransactionPayload) -> Result<()> {
    validate_transaction(
        payload.amount,
        &payload.type_,
        payload.account_id,
        payload.transfer_to_id,
    )?;

    let tx = conn.transaction()?;

    let (old_account_id, old_amount, old_type_, old_transfer_to_id, goal_id) = {
        let mut stmt = tx.prepare("SELECT account_id, amount, type, transfer_to_id, goal_id FROM transactions WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            (
                row.get::<_, i64>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, Option<i64>>(4)?,
            )
        } else {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
    };

    if old_type_ == "income" {
        tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![old_amount, old_account_id])?;
    } else if old_type_ == "expense" {
        tx.execute("UPDATE accounts SET balance = balance + ?1 WHERE id = ?2", params![old_amount, old_account_id])?;
    } else if old_type_ == "transfer" {
        if let Some(transfer_to) = old_transfer_to_id {
            tx.execute("UPDATE accounts SET balance = balance + ?1 WHERE id = ?2", params![old_amount, old_account_id])?;
            tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![old_amount, transfer_to])?;
        }
    }

    // Apply new balance
    if payload.type_ == "income" {
        tx.execute("UPDATE accounts SET balance = balance + ?1 WHERE id = ?2", params![payload.amount, payload.account_id])?;
    } else if payload.type_ == "expense" {
        tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![payload.amount, payload.account_id])?;
    } else if payload.type_ == "transfer" {
        if let Some(transfer_to) = payload.transfer_to_id {
            tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![payload.amount, payload.account_id])?;
            tx.execute("UPDATE accounts SET balance = balance + ?1 WHERE id = ?2", params![payload.amount, transfer_to])?;
        }
    }

    // Update row
    tx.execute(
        "UPDATE transactions 
         SET account_id = ?1, category_id = ?2, amount = ?3, type = ?4, description = ?5, date = ?6, transfer_to_id = ?7, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?8",
        params![
            payload.account_id,
            payload.category_id,
            payload.amount,
            payload.type_,
            payload.description,
            payload.date,
            payload.transfer_to_id,
            id
        ],
    )?;

    if let Some(gid) = goal_id {
        let mut old_contribution = 0.0;
        if old_type_ == "expense" {
            old_contribution = old_amount;
        }
        let mut new_contribution = 0.0;
        if payload.type_ == "expense" {
            new_contribution = payload.amount;
        }
        let diff = new_contribution - old_contribution;
        tx.execute("UPDATE goals SET current_amount = current_amount + ?1 WHERE id = ?2", params![diff, gid])?;
    }

    // Handle tags
    tx.execute("DELETE FROM transaction_tags WHERE transaction_id = ?1", params![id])?;
    if let Some(tags_list) = payload.tags {
        for tag_name in tags_list {
            let tag_name = tag_name.trim();
            if !tag_name.is_empty() {
                let tag_id = tags::create_tag(&tx, tag_name, None)?;
                tags::add_tag_to_transaction(&tx, id, tag_id)?;
            }
        }
    }
    tags::prune_orphan_tags(&tx)?;

    tx.commit()?;
    Ok(())
}

pub fn get_transaction_by_id(conn: &Connection, id: i64) -> Result<Transaction> {
    let mut stmt = conn.prepare("
        SELECT t.id, t.account_id, t.category_id, t.amount, t.type, t.description, t.date, t.transfer_to_id, t.created_at, t.updated_at,
               GROUP_CONCAT(tg.name, char(31)) as tags_str
        FROM transactions t
        LEFT JOIN transaction_tags tt ON t.id = tt.transaction_id
        LEFT JOIN tags tg ON tt.tag_id = tg.id
        WHERE t.id = ?1
        GROUP BY t.id
    ")?;

    let row = stmt.query_row(params![id], |row| {
        let tags_str: Option<String> = row.get(10)?;
        let tags = tags_str.map(split_tags);

        Ok(Transaction {
            id: row.get(0)?,
            account_id: row.get(1)?,
            category_id: row.get(2)?,
            amount: row.get(3)?,
            type_: row.get(4)?,
            description: row.get(5)?,
            date: row.get(6)?,
            transfer_to_id: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
            tags,
        })
    })?;

    Ok(row)
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
            "INSERT INTO accounts (id, name, type, currency, balance) VALUES (2, 'B', 'bank', 'PLN', 0)",
            [],
        )
        .unwrap();
        conn
    }

    fn payload(type_: &str, transfer_to: Option<i64>, amount: f64) -> CreateTransactionPayload {
        CreateTransactionPayload {
            account_id: 1,
            category_id: None,
            amount,
            type_: type_.to_string(),
            description: Some("Test".to_string()),
            date: "2024-03-01".to_string(),
            transfer_to_id: transfer_to,
            tags: None,
        }
    }

    #[test]
    fn test_transfer_requires_target_account() {
        let mut conn = setup();
        assert!(create_transaction(&mut conn, payload("transfer", None, 100.0)).is_err());
    }

    #[test]
    fn test_transfer_to_same_account_is_rejected() {
        let mut conn = setup();
        assert!(create_transaction(&mut conn, payload("transfer", Some(1), 100.0)).is_err());
    }

    #[test]
    fn test_zero_and_negative_amounts_are_rejected() {
        let mut conn = setup();
        assert!(create_transaction(&mut conn, payload("expense", None, 0.0)).is_err());
        assert!(create_transaction(&mut conn, payload("expense", None, -50.0)).is_err());
        assert!(create_transaction(&mut conn, payload("expense", None, f64::NAN)).is_err());
    }

    #[test]
    fn test_rejected_transaction_leaves_balance_untouched() {
        let mut conn = setup();
        let _ = create_transaction(&mut conn, payload("transfer", None, 100.0));
        let balance: f64 = conn
            .query_row("SELECT balance FROM accounts WHERE id = 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(balance, 1000.0);
    }

    /// Przecinek jest legalnym znakiem w nazwie tagu i nie może rozbijać listy.
    #[test]
    fn test_tags_with_comma_survive_roundtrip() {
        let mut conn = setup();
        let mut p = payload("expense", None, 25.0);
        p.tags = Some(vec!["Warszawa, Centrum".to_string(), "dom".to_string()]);
        let id = create_transaction(&mut conn, p).unwrap();

        let tx = get_transaction_by_id(&conn, id).unwrap();
        let mut tags = tx.tags.unwrap();
        tags.sort();
        assert_eq!(tags, vec!["Warszawa, Centrum".to_string(), "dom".to_string()]);
    }

    #[test]
    fn test_delete_transaction_restores_balance_and_prunes_tags() {
        let mut conn = setup();
        let mut p = payload("expense", None, 300.0);
        p.tags = Some(vec!["jednorazowy".to_string()]);
        let id = create_transaction(&mut conn, p).unwrap();

        let after_insert: f64 = conn
            .query_row("SELECT balance FROM accounts WHERE id = 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(after_insert, 700.0);

        delete_transaction(&mut conn, id).unwrap();

        let after_delete: f64 = conn
            .query_row("SELECT balance FROM accounts WHERE id = 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(after_delete, 1000.0);

        let tag_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tags", [], |r| r.get(0))
            .unwrap();
        assert_eq!(tag_count, 0);
    }

    #[test]
    fn test_bulk_insert_skips_duplicates() {
        let mut conn = setup();
        let inserted = bulk_insert_transactions(
            &mut conn,
            vec![
                payload("expense", None, 10.0),
                payload("expense", None, 10.0), // identyczny wpis => duplikat
                payload("expense", None, 20.0),
            ],
        )
        .unwrap();
        assert_eq!(inserted, 2);
    }
}
