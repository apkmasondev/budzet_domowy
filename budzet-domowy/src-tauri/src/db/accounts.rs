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

    // Obsługa sierocych transferów (odwracanie sald na innych kontach)
    let transfers: Vec<(i64, Option<i64>, f64)> = {
        let mut stmt = tx.prepare("SELECT account_id, transfer_to_id, amount FROM transactions WHERE type = 'transfer' AND (account_id = ?1 OR transfer_to_id = ?1)")?;
        let res = stmt.query_map(params![id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?.collect::<Result<Vec<_>, _>>()?;
        res
    };

    for (acc_id, to_id, amount) in transfers {
        if acc_id == id {
            // Konto usuwane było źródłem — odbieramy środki koncu docelowemu.
            if let Some(other_id) = to_id {
                tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![amount, other_id])?;
            }
        } else if to_id == Some(id) {
            // Konto usuwane było celem — zwracamy środki koncu źródłowemu.
            tx.execute("UPDATE accounts SET balance = balance + ?1 WHERE id = ?2", params![amount, acc_id])?;
        }
    }

    // Obsługa wycofania środków z celów przed usunięciem powiązanych transakcji
    let goal_txs: Vec<(i64, f64)> = {
        let mut stmt = tx.prepare("SELECT goal_id, amount FROM transactions WHERE (account_id = ?1 OR transfer_to_id = ?1) AND type = 'expense' AND goal_id IS NOT NULL")?;
        let res = stmt.query_map(params![id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?.collect::<Result<Vec<_>, _>>()?;
        res
    };

    for (gid, amount) in goal_txs {
        tx.execute("UPDATE goals SET current_amount = current_amount - ?1 WHERE id = ?2", params![amount, gid])?;
    }

    // Musi obejmować także transfery przychodzące (transfer_to_id), inaczej ich tagi
    // zostają w transaction_tags jako sieroty po skasowaniu transakcji.
    tx.execute("DELETE FROM transaction_tags WHERE transaction_id IN (SELECT id FROM transactions WHERE account_id = ?1 OR transfer_to_id = ?1)", params![id])?;
    tx.execute("DELETE FROM transactions WHERE account_id = ?1 OR transfer_to_id = ?1", params![id])?;
    tx.execute("UPDATE recurring SET account_id = NULL WHERE account_id = ?1", params![id])?;
    tx.execute("DELETE FROM accounts WHERE id = ?1", params![id])?;
    crate::db::tags::prune_orphan_tags(&tx)?;
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
        crate::db::configure_connection(&conn).unwrap();
        conn
    }

    fn make_account(conn: &Connection, name: &str, balance: f64) -> i64 {
        create_account(
            conn,
            CreateAccountPayload {
                name: name.to_string(),
                type_: "bank".to_string(),
                currency: "PLN".to_string(),
                balance,
                color: None,
            },
        )
        .unwrap()
    }

    fn balance_of(conn: &Connection, id: i64) -> f64 {
        conn.query_row("SELECT balance FROM accounts WHERE id = ?1", [id], |r| r.get(0))
            .unwrap()
    }

    /// Usunięcie konta będącego CELEM przelewu musi oddać środki koncu źródłowemu.
    #[test]
    fn test_delete_account_reverts_incoming_transfer() {
        let mut conn = setup_in_memory_db();
        let source = make_account(&conn, "Źródłowe", 1000.0);
        let target = make_account(&conn, "Docelowe", 0.0);

        crate::db::transactions::create_transaction(
            &mut conn,
            crate::db::transactions::CreateTransactionPayload {
                account_id: source,
                category_id: None,
                amount: 250.0,
                type_: "transfer".to_string(),
                description: None,
                date: "2024-05-10".to_string(),
                transfer_to_id: Some(target),
                tags: Some(vec!["oszczednosci".to_string()]),
            },
        )
        .unwrap();

        assert_eq!(balance_of(&conn, source), 750.0);
        assert_eq!(balance_of(&conn, target), 250.0);

        delete_account(&mut conn, target).unwrap();

        // Środki wracają na konto źródłowe...
        assert_eq!(balance_of(&conn, source), 1000.0);
        // ...a po transakcji nie zostają osierocone powiązania z tagami.
        let orphan_tags: i64 = conn
            .query_row("SELECT COUNT(*) FROM transaction_tags", [], |r| r.get(0))
            .unwrap();
        assert_eq!(orphan_tags, 0);
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
