use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

use super::accounts::Account;
use super::categories::Category;
use super::transactions::Transaction;
use super::budgets::Budget;
use super::goals::Goal;
use super::recurring::Recurring;

#[derive(Serialize, Deserialize)]
pub struct BackupData {
    pub accounts: Vec<Account>,
    pub categories: Vec<Category>,
    pub transactions: Vec<Transaction>,
    pub budgets: Vec<Budget>,
    pub goals: Vec<Goal>,
    pub recurrings: Vec<Recurring>,
}

pub fn export_data(conn: &Connection) -> Result<BackupData> {
    let accounts = super::accounts::get_accounts(conn)?;
    let categories = super::categories::get_categories(conn)?;
    let transactions = super::transactions::get_transactions(conn)?;
    let budgets = super::budgets::get_all_budgets(conn)?;
    let goals = super::goals::get_goals(conn)?;
    let recurrings = super::recurring::get_recurrings(conn)?;

    Ok(BackupData {
        accounts,
        categories,
        transactions,
        budgets,
        goals,
        recurrings,
    })
}

pub fn import_data(conn: &mut Connection, backup: BackupData) -> Result<()> {
    let tx = conn.transaction()?;

    // Czyszczenie obecnej bazy danych
    tx.execute_batch("
        DELETE FROM transactions;
        DELETE FROM recurring;
        DELETE FROM goals;
        DELETE FROM budgets;
        DELETE FROM categories;
        DELETE FROM accounts;
    ")?;

    // Przywracanie kont
    for a in backup.accounts {
        tx.execute("INSERT INTO accounts (id, name, type, balance, currency) VALUES (?1, ?2, ?3, ?4, ?5)", 
            params![a.id, a.name, a.type_, a.balance, a.currency])?;
    }

    // Przywracanie kategorii
    for c in backup.categories {
        tx.execute("INSERT INTO categories (id, name, type, color, icon) VALUES (?1, ?2, ?3, ?4, ?5)", 
            params![c.id, c.name, c.type_, c.color, c.icon])?;
    }

    // Przywracanie transakcji
    for t in backup.transactions {
        tx.execute("INSERT INTO transactions (id, account_id, category_id, type, amount, date, description, transfer_to_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)", 
            params![t.id, t.account_id, t.category_id, t.type_, t.amount, t.date, t.description, t.transfer_to_id])?;
    }

    // Przywracanie budżetów
    for b in backup.budgets {
        tx.execute("INSERT INTO budgets (id, category_id, month, amount) VALUES (?1, ?2, ?3, ?4)", 
            params![b.id, b.category_id, b.month, b.amount])?;
    }

    // Przywracanie celów
    for g in backup.goals {
        tx.execute("INSERT INTO goals (id, name, target_amount, current_amount, deadline, icon, color, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)", 
            params![g.id, g.name, g.target_amount, g.current_amount, g.deadline, g.icon, g.color, g.created_at])?;
    }

    // Przywracanie płatności cyklicznych
    for r in backup.recurrings {
        tx.execute("INSERT INTO recurring (id, name, amount, category_id, account_id, frequency, next_date, day_of_month, active) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)", 
            params![r.id, r.name, r.amount, r.category_id, r.account_id, r.frequency, r.next_date, r.day_of_month, r.active])?;
    }

    tx.commit()?;
    Ok(())
}
