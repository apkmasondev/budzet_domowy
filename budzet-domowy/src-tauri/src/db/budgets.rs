use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Budget {
    pub id: i64,
    pub category_id: i64,
    pub month: String,
    pub amount: f64,
}

#[derive(Deserialize)]
pub struct UpsertBudgetPayload {
    pub category_id: i64,
    pub month: String,
    pub amount: f64,
}

pub fn upsert_budget(conn: &Connection, payload: UpsertBudgetPayload) -> Result<()> {
    conn.execute(
        "INSERT INTO budgets (category_id, month, amount) VALUES (?1, ?2, ?3)
         ON CONFLICT(category_id, month) DO UPDATE SET amount=excluded.amount",
        params![payload.category_id, payload.month, payload.amount],
    )?;
    Ok(())
}

pub fn get_budgets(conn: &Connection, month: &str) -> Result<Vec<Budget>> {
    let mut stmt = conn.prepare("SELECT id, category_id, month, amount FROM budgets WHERE month = ?1")?;
    let iter = stmt.query_map(params![month], |row| {
        Ok(Budget {
            id: row.get(0)?,
            category_id: row.get(1)?,
            month: row.get(2)?,
            amount: row.get(3)?,
        })
    })?;

    let mut res = Vec::new();
    for item in iter {
        res.push(item?);
    }
    Ok(res)
}

pub fn get_all_budgets(conn: &Connection) -> Result<Vec<Budget>> {
    let mut stmt = conn.prepare("SELECT id, category_id, month, amount FROM budgets")?;
    let iter = stmt.query_map([], |row| {
        Ok(Budget {
            id: row.get(0)?,
            category_id: row.get(1)?,
            month: row.get(2)?,
            amount: row.get(3)?,
        })
    })?;

    let mut res = Vec::new();
    for item in iter {
        res.push(item?);
    }
    Ok(res)
}

pub fn copy_budgets_to_month(conn: &Connection, from_month: &str, to_month: &str) -> Result<()> {
    let old_budgets = get_budgets(conn, from_month)?;
    for b in old_budgets {
        upsert_budget(conn, UpsertBudgetPayload {
            category_id: b.category_id,
            month: to_month.to_string(),
            amount: b.amount,
        })?;
    }
    Ok(())
}
