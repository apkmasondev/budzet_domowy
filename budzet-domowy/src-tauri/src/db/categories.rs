use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "type")]
    pub type_: String,
    pub parent_id: Option<i64>,
}

pub fn seed_default_categories(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM categories", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let expenses = [
        ("Jedzenie", "#FF6B6B"), ("Transport", "#4ECDC4"), ("Mieszkanie", "#A05195"), 
        ("Zdrowie", "#1DD1A1"), ("Rozrywka", "#F368E0"), ("Ubrania", "#2D9596"), 
        ("Edukacja", "#FECA57"), ("Restauracje", "#FF9F43"), ("Sport", "#10AC84"), 
        ("Elektronika", "#54A0FF"), ("Prezenty", "#5F27CD"), ("Inne", "#C8D6E5")
    ];

    let incomes = [
        ("Wynagrodzenie", "#10B981"), ("Freelance", "#0ABDE3"), ("Dywidendy", "#8B5CF6"), 
        ("Sprzedaż", "#FF9FF3"), ("Inne przychody", "#8395A7")
    ];

    for (name, color) in expenses {
        conn.execute(
            "INSERT INTO categories (name, type, color) VALUES (?1, 'expense', ?2)",
            [name, color],
        )?;
    }

    for (name, color) in incomes {
        conn.execute(
            "INSERT INTO categories (name, type, color) VALUES (?1, 'income', ?2)",
            [name, color],
        )?;
    }

    Ok(())
}

pub fn migrate_default_colors(conn: &Connection) -> Result<()> {
    // (Name, New Color, Old Color)
    let color_map = [
        ("Jedzenie", "#FF6B6B", "#f59e0b"), ("Transport", "#4ECDC4", "#3b82f6"), ("Mieszkanie", "#A05195", "#8b5cf6"), 
        ("Zdrowie", "#1DD1A1", "#10b981"), ("Rozrywka", "#F368E0", "#ec4899"), ("Ubrania", "#2D9596", "#06b6d4"), 
        ("Edukacja", "#FECA57", "#f97316"), ("Restauracje", "#FF9F43", "#ef4444"), ("Sport", "#10AC84", "#14b8a6"), 
        ("Elektronika", "#54A0FF", "#6366f1"), ("Prezenty", "#5F27CD", "#d946ef"), ("Inne", "#C8D6E5", "#64748b"),
        ("Wynagrodzenie", "#10B981", "#10b981"), ("Freelance", "#0ABDE3", "#3b82f6"), ("Dywidendy", "#8B5CF6", "#8b5cf6"), 
        ("Sprzedaż", "#FF9FF3", "#f59e0b"), ("Inne przychody", "#8395A7", "#64748b")
    ];

    for (name, new_color, old_color) in color_map {
        conn.execute(
            "UPDATE categories SET color = ?1 WHERE name = ?2 AND (color IS NULL OR color = ?3)",
            [new_color, name, old_color],
        )?;
    }
    Ok(())
}

pub fn get_categories(conn: &Connection) -> Result<Vec<Category>> {
    let mut stmt = conn.prepare("SELECT id, name, icon, color, type, parent_id FROM categories ORDER BY name ASC")?;
    let cat_iter = stmt.query_map([], |row| {
        Ok(Category {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            type_: row.get(4)?,
            parent_id: row.get(5)?,
        })
    })?;

    let mut categories = Vec::new();
    for cat in cat_iter {
        categories.push(cat?);
    }
    Ok(categories)
}

pub fn create_category(conn: &Connection, name: &str, type_: &str, color: Option<&str>) -> Result<i64> {
    conn.execute(
        "INSERT INTO categories (name, type, color) VALUES (?1, ?2, ?3)",
        rusqlite::params![name, type_, color],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_category(conn: &Connection, id: i64) -> Result<()> {
    // Delete transactions associated with this category or set them to NULL.
    // For safety, let's set them to NULL so we don't lose transaction history!
    conn.execute("UPDATE transactions SET category_id = NULL WHERE category_id = ?1", [id])?;
    conn.execute("UPDATE budgets SET category_id = NULL WHERE category_id = ?1", [id])?;
    conn.execute("UPDATE recurring SET category_id = NULL WHERE category_id = ?1", [id])?;
    
    conn.execute("DELETE FROM categories WHERE id = ?1", [id])?;
    Ok(())
}
