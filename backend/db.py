import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).with_name("timetable.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def _ensure_migrations(conn: sqlite3.Connection):
    # --- Migration 1: lab_rooms.short column ---
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(lab_rooms)").fetchall()]
    if "short" not in cols:
        conn.execute("ALTER TABLE lab_rooms ADD COLUMN short TEXT;")
        # backfill: if short empty, set to code
        conn.execute("UPDATE lab_rooms SET short = code WHERE short IS NULL OR short = '';")

def init_db():
    schema_path = Path(__file__).with_name("schema.sql")
    with get_conn() as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        _ensure_migrations(conn)   # ✅ add this
        conn.commit()
