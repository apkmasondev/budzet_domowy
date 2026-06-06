use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Goal {
    pub id: i64,
    pub name: String,
    pub target_amount: f64,
    pub current_amount: f64,
    pub deadline: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateGoalPayload {
    pub name: String,
    pub target_amount: f64,
    pub deadline: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
}

pub fn create_goal(conn: &Connection, payload: CreateGoalPayload) -> Result<i64> {
    conn.execute(
        "INSERT INTO goals (name, target_amount, current_amount, deadline, icon, color) VALUES (?1, ?2, 0, ?3, ?4, ?5)",
        params![payload.name, payload.target_amount, payload.deadline, payload.icon, payload.color],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_goals(conn: &Connection) -> Result<Vec<Goal>> {
    let mut stmt = conn.prepare("SELECT id, name, target_amount, current_amount, deadline, icon, color, created_at FROM goals ORDER BY created_at DESC")?;
    let iter = stmt.query_map([], |row| {
        Ok(Goal {
            id: row.get(0)?,
            name: row.get(1)?,
            target_amount: row.get(2)?,
            current_amount: row.get(3)?,
            deadline: row.get(4)?,
            icon: row.get(5)?,
            color: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;

    let mut res = Vec::new();
    for item in iter {
        res.push(item?);
    }
    Ok(res)
}

#[derive(Deserialize)]
pub struct AddToGoalPayload {
    pub goal_id: i64,
    pub amount: f64,
    pub account_id: i64,
    pub date: String,
}

pub fn add_to_goal(conn: &mut Connection, payload: AddToGoalPayload) -> Result<()> {
    let tx = conn.transaction()?;

    let description = format!("Wpłata na cel oszczędnościowy");
    tx.execute(
        "INSERT INTO transactions (account_id, category_id, amount, type, description, date, transfer_to_id)
         VALUES (?1, NULL, ?2, 'expense', ?3, ?4, NULL)",
        params![
            payload.account_id,
            payload.amount,
            description,
            payload.date
        ],
    )?;
    
    tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![payload.amount, payload.account_id])?;
    
    tx.execute("UPDATE goals SET current_amount = current_amount + ?1 WHERE id = ?2", params![payload.amount, payload.goal_id])?;

    tx.commit()?;
    Ok(())
}

pub fn delete_goal(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM goals WHERE id = ?1", params![id])?;
    Ok(())
}
