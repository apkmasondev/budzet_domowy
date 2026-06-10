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

pub fn create_transaction(conn: &mut Connection, payload: CreateTransactionPayload) -> Result<i64> {
    if payload.amount <= 0.0 {
        return Err(rusqlite::Error::InvalidParameterName("Kwota musi być większa od zera".to_string()));
    }
    if payload.type_ != "income" && payload.type_ != "expense" && payload.type_ != "transfer" {
        return Err(rusqlite::Error::InvalidParameterName("Nieprawidłowy typ transakcji".to_string()));
    }

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

pub fn get_transactions(conn: &Connection, limit: u32, offset: u32) -> Result<Vec<Transaction>> {
    let mut stmt = conn.prepare("
        SELECT t.id, t.account_id, t.category_id, t.amount, t.type, t.description, t.date, t.transfer_to_id, t.created_at, t.updated_at,
               GROUP_CONCAT(tg.name, ',') as tags_str
        FROM transactions t
        LEFT JOIN transaction_tags tt ON t.id = tt.transaction_id
        LEFT JOIN tags tg ON tt.tag_id = tg.id
        GROUP BY t.id
        ORDER BY t.date DESC, t.id DESC 
        LIMIT ?1 OFFSET ?2
    ")?;
    let iter = stmt.query_map(params![limit, offset], |row| {
        let id: i64 = row.get(0)?;
        let tags_str: Option<String> = row.get(10)?;
        let tags = tags_str.map(|s| s.split(',').map(|tag| tag.to_string()).collect());

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

pub fn get_transactions_count(conn: &Connection) -> Result<u32> {
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM transactions")?;
    stmt.query_row([], |row| row.get(0))
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
            if let Ok(hash) = item {
                existing_hashes.insert(hash);
            }
        }
    }

    for payload in payloads {
        if payload.amount <= 0.0 {
            return Err(rusqlite::Error::InvalidParameterName("Kwota musi być większa od zera".to_string()));
        }
        if payload.type_ != "income" && payload.type_ != "expense" && payload.type_ != "transfer" {
            return Err(rusqlite::Error::InvalidParameterName("Nieprawidłowy typ transakcji".to_string()));
        }

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

    let (account_id, amount, type_, transfer_to_id) = {
        let mut stmt = tx.prepare("SELECT account_id, amount, type, transfer_to_id FROM transactions WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            (
                row.get::<_, i64>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
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

    tx.execute("DELETE FROM transaction_tags WHERE transaction_id = ?1", params![id])?;
    tx.execute("DELETE FROM transactions WHERE id = ?1", params![id])?;

    tx.commit()?;
    Ok(())
}

pub fn update_transaction(conn: &mut Connection, id: i64, payload: UpdateTransactionPayload) -> Result<()> {
    if payload.amount <= 0.0 {
        return Err(rusqlite::Error::InvalidParameterName("Kwota musi być większa od zera".to_string()));
    }
    if payload.type_ != "income" && payload.type_ != "expense" && payload.type_ != "transfer" {
        return Err(rusqlite::Error::InvalidParameterName("Nieprawidłowy typ transakcji".to_string()));
    }

    let tx = conn.transaction()?;

    let (old_account_id, old_amount, old_type_, old_transfer_to_id) = {
        let mut stmt = tx.prepare("SELECT account_id, amount, type, transfer_to_id FROM transactions WHERE id = ?1")?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            (
                row.get::<_, i64>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<i64>>(3)?,
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

    tx.commit()?;
    Ok(())
}
