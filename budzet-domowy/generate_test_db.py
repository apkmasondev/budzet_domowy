import sqlite3
import random
import os
from datetime import datetime, timedelta

db_path = "test_data_2m.db"
schema_path = "src-tauri/src/db/schema.sql"

if os.path.exists(db_path):
    os.remove(db_path)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# 1. Wczytaj i wykonaj schemat
with open(schema_path, "r", encoding="utf-8") as f:
    cursor.executescript(f.read())

# 2. Kategorie
categories = [
    ("Jedzenie", "expense", "#10b981"),
    ("Mieszkanie", "expense", "#8b5cf6"),
    ("Transport", "expense", "#f59e0b"),
    ("Rozrywka", "expense", "#ec4899"),
    ("Wypłata", "income", "#3b82f6"),
    ("Inne Przychody", "income", "#14b8a6")
]
for name, ctype, color in categories:
    cursor.execute("INSERT INTO categories (name, type, color) VALUES (?, ?, ?)", (name, ctype, color))

# 3. Konta
cursor.execute("INSERT INTO accounts (name, type, currency, balance) VALUES ('Konto Główne', 'Bank', 'PLN', 0)")
cursor.execute("INSERT INTO accounts (name, type, currency, balance) VALUES ('Gotówka', 'Cash', 'PLN', 0)")
cursor.execute("INSERT INTO accounts (name, type, currency, balance) VALUES ('Oszczędnościowe', 'Savings', 'PLN', 0)")

# 4. Transakcje dla ostatnich 2 miesięcy (Maj i Czerwiec 2026)
# Zakładamy, że dzisiaj to czerwiec 2026.
base_date = datetime(2026, 5, 1)
end_date = datetime(2026, 6, 25)

balances = {1: 0.0, 2: 0.0, 3: 0.0}

def add_tx(acc_id, cat_id, amt, ttype, desc, date_str):
    cursor.execute("""
        INSERT INTO transactions (account_id, category_id, amount, type, description, date)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (acc_id, cat_id, amt, ttype, desc, date_str))
    
    if ttype == "income":
        balances[acc_id] += amt
    elif ttype == "expense":
        balances[acc_id] -= amt

# Generowanie stałych wydatków i wpływów
for month in [5, 6]:
    # Wypłata na początku miesiąca
    date_str = f"2026-0{month}-10"
    add_tx(1, 5, 6500.0, "income", "Wynagrodzenie", date_str)
    
    # Czynsz
    date_str = f"2026-0{month}-05"
    add_tx(1, 2, 2500.0, "expense", "Wynajem i rachunki", date_str)
    
    # Paliwo
    date_str = f"2026-0{month}-12"
    add_tx(1, 3, 300.0, "expense", "Stacja Orlen", date_str)
    
    # Transfer na oszczędnościowe
    date_str = f"2026-0{month}-15"
    add_tx(3, None, 1000.0, "income", "Wpłata na oszczędności", date_str)
    balances[1] -= 1000.0 # Ręczna korekta dla transferu (tu dla testu robimy sztuczne income/expense)
    cursor.execute("""
        INSERT INTO transactions (account_id, transfer_to_id, amount, type, description, date)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (1, 3, 1000.0, "transfer", "Przelew własny", date_str))

# Generowanie losowych wydatków (jedzenie, rozrywka)
current_date = base_date
while current_date <= end_date:
    # Jedzenie (co 2-3 dni)
    if random.random() > 0.6:
        amt = round(random.uniform(50, 150), 2)
        add_tx(1, 1, amt, "expense", "Biedronka / Lidl", current_date.strftime("%Y-%m-%d"))
        
    # Rozrywka (w weekendy)
    if current_date.weekday() >= 5 and random.random() > 0.5:
        amt = round(random.uniform(100, 300), 2)
        add_tx(1, 4, amt, "expense", "Restauracja / Kino", current_date.strftime("%Y-%m-%d"))
        
    current_date += timedelta(days=1)

# Uaktualnienie sald kont
for acc_id, bal in balances.items():
    cursor.execute("UPDATE accounts SET balance = ? WHERE id = ?", (bal, acc_id))

# 5. Budżety i Cele
cursor.execute("INSERT INTO budgets (category_id, month, amount) VALUES (1, '2026-06', 1500.0)")
cursor.execute("INSERT INTO budgets (category_id, month, amount) VALUES (4, '2026-06', 800.0)")

cursor.execute("INSERT INTO goals (name, target_amount, current_amount, deadline) VALUES ('Wakacje w Grecji', 5000.0, 2000.0, '2026-08-01')")

# Zapisz
conn.commit()
conn.close()

print("Plik test_data_2m.db zostal wygenerowany!")
