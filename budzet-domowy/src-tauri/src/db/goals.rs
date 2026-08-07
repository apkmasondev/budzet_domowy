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

fn validate_amount(value: f64, label: &str, allow_zero: bool) -> Result<()> {
    let invalid = !value.is_finite() || (if allow_zero { value < 0.0 } else { value <= 0.0 });
    if invalid {
        return Err(rusqlite::Error::InvalidParameterName(format!(
            "{} musi być liczbą {} od zera",
            label,
            if allow_zero { "nieujemną" } else { "większą" }
        )));
    }
    Ok(())
}

pub fn create_goal(conn: &Connection, payload: CreateGoalPayload) -> Result<i64> {
    validate_amount(payload.target_amount, "Kwota docelowa", false)?;
    conn.execute(
        "INSERT INTO goals (name, target_amount, current_amount, deadline, icon, color) VALUES (?1, ?2, 0, ?3, ?4, ?5)",
        params![payload.name, payload.target_amount, payload.deadline, payload.icon, payload.color],
    )?;
    Ok(conn.last_insert_rowid())
}

#[derive(Deserialize)]
pub struct UpdateGoalPayload {
    pub name: String,
    pub target_amount: f64,
    pub current_amount: f64,
    pub deadline: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
}

pub fn update_goal(conn: &Connection, id: i64, payload: UpdateGoalPayload) -> Result<()> {
    validate_amount(payload.target_amount, "Kwota docelowa", false)?;
    validate_amount(payload.current_amount, "Kwota zgromadzona", true)?;
    conn.execute(
        "UPDATE goals SET name = ?1, target_amount = ?2, current_amount = ?3, deadline = ?4, icon = ?5, color = ?6 WHERE id = ?7",
        params![payload.name, payload.target_amount, payload.current_amount, payload.deadline, payload.icon, payload.color, id],
    )?;
    Ok(())
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
    validate_amount(payload.amount, "Kwota wpłaty", false)?;

    let tx = conn.transaction()?;

    let description = "Wpłata na cel oszczędnościowy";
    tx.execute(
        "INSERT INTO transactions (account_id, category_id, amount, type, description, date, transfer_to_id, goal_id)
         VALUES (?1, NULL, ?2, 'expense', ?3, ?4, NULL, ?5)",
        params![
            payload.account_id,
            payload.amount,
            description,
            payload.date,
            payload.goal_id
        ],
    )?;
    
    tx.execute("UPDATE accounts SET balance = balance - ?1 WHERE id = ?2", params![payload.amount, payload.account_id])?;
    
    tx.execute("UPDATE goals SET current_amount = current_amount + ?1 WHERE id = ?2", params![payload.amount, payload.goal_id])?;

    tx.commit()?;
    Ok(())
}

pub fn delete_goal(conn: &mut Connection, id: i64) -> Result<()> {
    let tx = conn.transaction()?;
    // Historia wpłat zostaje (pieniądze realnie wyszły z konta), ale musi stracić
    // wskazanie na nieistniejący już cel — inaczej `goal_id` jest wiszącą referencją.
    tx.execute("UPDATE transactions SET goal_id = NULL WHERE goal_id = ?1", params![id])?;
    tx.execute("DELETE FROM goals WHERE id = ?1", params![id])?;
    tx.commit()?;
    Ok(())
}
