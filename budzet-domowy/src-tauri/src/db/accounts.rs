use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Account {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub currency: String,
    pub balance: f64,
    pub color: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateAccountPayload {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub currency: String,
    pub balance: f64,
    pub color: Option<String>,
}

pub fn create_account(conn: &Connection, payload: CreateAccountPayload) -> Result<i64> {
    conn.execute(
        "INSERT INTO accounts (name, type, currency, balance, color) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![payload.name, payload.type_, payload.currency, payload.balance, payload.color],
    )?;
    Ok(conn.last_insert_rowid())
}

#[derive(Deserialize)]
pub struct UpdateAccountPayload {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub currency: String,
    pub balance: f64,
    pub color: Option<String>,
}

pub fn update_account(conn: &Connection, id: i64, payload: UpdateAccountPayload) -> Result<()> {
    conn.execute(
        "UPDATE accounts SET name = ?1, type = ?2, currency = ?3, balance = ?4, color = ?5 WHERE id = ?6",
        params![payload.name, payload.type_, payload.currency, payload.balance, payload.color, id],
    )?;
    Ok(())
}

pub fn get_accounts(conn: &Connection) -> Result<Vec<Account>> {
    let mut stmt = conn.prepare("SELECT id, name, type, currency, balance, color, created_at FROM accounts ORDER BY id ASC")?;
    let account_iter = stmt.query_map([], |row| {
        Ok(Account {
            id: row.get(0)?,
            name: row.get(1)?,
            type_: row.get(2)?,
            currency: row.get(3)?,
            balance: row.get(4)?,
            color: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;

    let mut accounts = Vec::new();
    for acc in account_iter {
        accounts.push(acc?);
    }
    Ok(accounts)
}

pub fn delete_account(conn: &mut Connection, id: i64) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM transaction_tags WHERE transaction_id IN (SELECT id FROM transactions WHERE account_id = ?1)", params![id])?;
    tx.execute("DELETE FROM transactions WHERE account_id = ?1 OR transfer_to_id = ?1", params![id])?;
    tx.execute("UPDATE recurring SET account_id = NULL WHERE account_id = ?1", params![id as i32])?;
    tx.execute("DELETE FROM accounts WHERE id = ?1", params![id])?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_in_memory_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run_migrations(&mut conn).unwrap();
        conn
    }

    #[test]
    fn test_create_and_get_account() {
        let conn = setup_in_memory_db();
        
        let payload = CreateAccountPayload {
            name: "Test Bank".to_string(),
            type_: "bank".to_string(),
            currency: "PLN".to_string(),
            balance: 1000.50,
            color: Some("#ff0000".to_string()),
        };
        
        let id = create_account(&conn, payload).unwrap();
        assert_eq!(id, 1);
        
        let accounts = get_accounts(&conn).unwrap();
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].name, "Test Bank");
        assert_eq!(accounts[0].balance, 1000.50);
        assert_eq!(accounts[0].color.as_deref(), Some("#ff0000"));
    }

    #[test]
    fn test_delete_account() {
        let mut conn = setup_in_memory_db();
        
        let payload = CreateAccountPayload {
            name: "Test Bank".to_string(),
            type_: "bank".to_string(),
            currency: "PLN".to_string(),
            balance: 1000.50,
            color: None,
        };
        
        let id = create_account(&conn, payload).unwrap();
        assert_eq!(get_accounts(&conn).unwrap().len(), 1);
        
        delete_account(&mut conn, id).unwrap();
        assert_eq!(get_accounts(&conn).unwrap().len(), 0);
    }
}
