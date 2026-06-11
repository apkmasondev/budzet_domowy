use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

pub fn get_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("schema.sql")), // V1 - base schema
        M::up(
            "
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT
            );

            CREATE TABLE IF NOT EXISTS transaction_tags (
                transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (transaction_id, tag_id)
            );
            ",
        ), // V2 - tags support
        M::up(
            "
            CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
            CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
            ",
        ), // V3 - performance indexes
        M::up(
            "
            CREATE INDEX IF NOT EXISTS idx_transaction_tags_tag_id ON transaction_tags(tag_id);
            ",
        ), // V4 - missing tag index
        M::up(
            "
            ALTER TABLE transactions ADD COLUMN goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at);
            ",
        ), // V5 - goal dependency and index
    ])
}

pub fn run_migrations(conn: &mut Connection) -> Result<(), rusqlite_migration::Error> {
    let migrations = get_migrations();
    migrations.to_latest(conn)?;
    Ok(())
}
