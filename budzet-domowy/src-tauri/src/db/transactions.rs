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
                tags::add_tag_to_transaction(&tx, last_id as i32, tag_id)?;
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

pub fn get_transactions(conn: &Connection) -> Result<Vec<Transaction>> {
    let mut stmt = conn.prepare("SELECT id, account_id, category_id, amount, type, description, date, transfer_to_id, created_at, updated_at FROM transactions ORDER BY date DESC, id DESC")?;
    let iter = stmt.query_map([], |row| {
        let id: i64 = row.get(0)?;
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
            tags: None,
        })
    })?;

    let mut transactions = Vec::new();
    for item in iter {
        transactions.push(item?);
    }

    // Pobranie wszystkich tagów dla transakcji w jednym zapytaniu, żeby uniknąć N+1 Queries
    let mut tags_map: std::collections::HashMap<i64, Vec<String>> = std::collections::HashMap::new();
    let mut stmt_tags = conn.prepare("
        SELECT tt.transaction_id, t.name 
        FROM transaction_tags tt 
        JOIN tags t ON tt.tag_id = t.id
    ")?;
    
    let tags_iter = stmt_tags.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })?;

    for item in tags_iter {
        if let Ok((tx_id, tag_name)) = item {
            tags_map.entry(tx_id).or_default().push(tag_name);
        }
    }

    // Przypisanie tagów do transakcji w pamięci RAM
    for tx in &mut transactions {
        if let Some(tags) = tags_map.remove(&tx.id) {
            tx.tags = Some(tags);
        }
    }

    Ok(transactions)
}

pub fn bulk_insert_transactions(conn: &mut Connection, payloads: Vec<CreateTransactionPayload>) -> Result<usize> {
    let tx = conn.transaction()?;
    let mut count = 0;

    for payload in payloads {
        if payload.amount <= 0.0 {
            return Err(rusqlite::Error::InvalidParameterName("Kwota musi być większa od zera".to_string()));
        }

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
                    tags::add_tag_to_transaction(&tx, last_id as i32, tag_id)?;
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
                tags::add_tag_to_transaction(&tx, id as i32, tag_id)?;
            }
        }
    }

    tx.commit()?;
    Ok(())
}
