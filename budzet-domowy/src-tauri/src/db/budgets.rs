use rusqlite::{Connection, Result, params};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct UpsertBudgetPayload {
    pub category_id: i64,
    pub month: String,
    pub amount: f64,
}

/// Sortowanie i porównania miesięcy w ZBB są leksykalne, więc format "RRRR-MM"
/// jest twardym wymogiem — dowolny inny łańcuch cicho psuł carry-over.
fn is_valid_month(month: &str) -> bool {
    let bytes = month.as_bytes();
    if bytes.len() != 7 || bytes[4] != b'-' {
        return false;
    }
    if !bytes[..4].iter().all(u8::is_ascii_digit) || !bytes[5..].iter().all(u8::is_ascii_digit) {
        return false;
    }
    matches!(month[5..].parse::<u32>(), Ok(1..=12))
}

pub fn upsert_budget(conn: &Connection, payload: UpsertBudgetPayload) -> Result<()> {
    // Ujemny przydział rozjeżdżał "Do Rozdysponowania" (rollover liczy tylko dodatnie
    // wartości, więc ujemna kwota znikała z bilansu bez śladu).
    if !payload.amount.is_finite() || payload.amount < 0.0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Przydzielona kwota nie może być ujemna".to_string(),
        ));
    }
    if !is_valid_month(&payload.month) {
        return Err(rusqlite::Error::InvalidParameterName(
            "Miesiąc musi być w formacie RRRR-MM".to_string(),
        ));
    }
    conn.execute(
        "INSERT INTO budgets (category_id, month, amount) VALUES (?1, ?2, ?3)
         ON CONFLICT(category_id, month) DO UPDATE SET amount=excluded.amount",
        params![payload.category_id, payload.month, payload.amount],
    )?;
    Ok(())
}

pub fn copy_budgets_to_month(conn: &mut Connection, from_month: &str, to_month: &str) -> Result<()> {
    if !is_valid_month(from_month) || !is_valid_month(to_month) {
        return Err(rusqlite::Error::InvalidParameterName(
            "Miesiąc musi być w formacie RRRR-MM".to_string(),
        ));
    }

    // Kopiowanie musi być atomowe — przy błędzie w połowie użytkownik zostawał
    // z częściowo przepisanym planem budżetu.
    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO budgets (category_id, month, amount)
         SELECT category_id, ?2, amount FROM budgets WHERE month = ?1
         ON CONFLICT(category_id, month) DO UPDATE SET amount = excluded.amount",
        params![from_month, to_month],
    )?;
    tx.commit()?;
    Ok(())
}
