use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Tag {
    pub id: i64,
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

pub fn create_tag(conn: &Connection, name: &str, color: Option<&str>) -> Result<i64> {
    // Sprawdzamy czy tag istnieje
    let mut stmt = conn.prepare("SELECT id FROM tags WHERE name = ?1")?;
    if let Ok(id) = stmt.query_row(params![name], |row| row.get(0)) {
        return Ok(id);
    }

    conn.execute(
        "INSERT INTO tags (name, color) VALUES (?1, ?2)",
        params![name, color],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn add_tag_to_transaction(conn: &Connection, transaction_id: i64, tag_id: i64) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?1, ?2)",
        params![transaction_id, tag_id],
    )?;
    Ok(())
}

/// Usuwa tagi, do których nie odwołuje się już żadna transakcja.
/// Bez tego lista podpowiedzi w modalu transakcji puchła o nazwy nieużywane
/// od dawna (tagi nigdy nie były sprzątane po edycji ani usunięciu wpisu).
pub fn prune_orphan_tags(conn: &Connection) -> Result<()> {
    conn.execute(
        "DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM transaction_tags)",
        [],
    )?;
    Ok(())
}
