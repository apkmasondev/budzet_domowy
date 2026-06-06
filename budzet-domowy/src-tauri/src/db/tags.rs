use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Tag {
    pub id: i32,
    pub name: String,
    pub color: Option<String>,
}

pub fn get_all_tags(conn: &Connection) -> Result<Vec<Tag>> {
    let mut stmt = conn.prepare("SELECT id, name, color FROM tags ORDER BY name")?;
    let tags_iter = stmt.query_map([], |row| {
        Ok(Tag {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
        })
    })?;

    let mut tags = Vec::new();
    for tag in tags_iter {
        tags.push(tag?);
    }
    Ok(tags)
}

pub fn create_tag(conn: &Connection, name: &str, color: Option<&str>) -> Result<i32> {
    // Sprawdzamy czy tag istnieje
    let mut stmt = conn.prepare("SELECT id FROM tags WHERE name = ?1")?;
    if let Ok(id) = stmt.query_row(params![name], |row| row.get(0)) {
        return Ok(id);
    }

    conn.execute(
        "INSERT INTO tags (name, color) VALUES (?1, ?2)",
        params![name, color],
    )?;
    Ok(conn.last_insert_rowid() as i32)
}

pub fn add_tag_to_transaction(conn: &Connection, transaction_id: i32, tag_id: i32) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?1, ?2)",
        params![transaction_id, tag_id],
    )?;
    Ok(())
}

pub fn get_tags_for_transaction(conn: &Connection, transaction_id: i32) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT t.name FROM tags t
         JOIN transaction_tags tt ON t.id = tt.tag_id
         WHERE tt.transaction_id = ?1
         ORDER BY t.name"
    )?;
    
    let tags_iter = stmt.query_map(params![transaction_id], |row| row.get::<_, String>(0))?;
    
    let mut tags = Vec::new();
    for tag in tags_iter {
        tags.push(tag?);
    }
    Ok(tags)
}

pub fn set_transaction_tags(conn: &Connection, transaction_id: i32, tags: Vec<String>) -> Result<()> {
    // Najpierw usuwamy stare tagi
    conn.execute("DELETE FROM transaction_tags WHERE transaction_id = ?1", params![transaction_id])?;

    // Dodajemy nowe tagi
    for tag_name in tags {
        let tag_id = create_tag(conn, &tag_name, None)?;
        add_tag_to_transaction(conn, transaction_id, tag_id)?;
    }

    Ok(())
}
