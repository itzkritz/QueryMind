import sqlite3
import os

db_dir = "d:/QueryMind/server/uploads/sqlite"
os.makedirs(db_dir, exist_ok=True)
db_path = f"{db_dir}/sample.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Drop existing
cursor.execute("DROP TABLE IF EXISTS orders")
cursor.execute("DROP TABLE IF EXISTS users")

# Create tables
cursor.execute("""
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'Member'
)
""")

cursor.execute("""
CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
)
""")

# Insert data
cursor.executemany("INSERT INTO users VALUES (?, ?, ?, ?)", [
    (1, "Alice Smith", "alice@example.com", "Admin"),
    (2, "Bob Jones", "bob@example.com", "Member"),
    (3, "Charlie Green", "charlie@example.com", "Member"),
])

cursor.executemany("INSERT INTO orders VALUES (?, ?, ?, ?)", [
    (101, 1, 150.50, "2026-06-14"),
    (102, 2, 45.00, "2026-06-14"),
    (103, 1, 89.99, "2026-06-14"),
])

conn.commit()
conn.close()
print("Sample SQLite database created successfully at:", db_path)
