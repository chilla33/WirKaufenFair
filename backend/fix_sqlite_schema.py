"""Small helper to patch a local sqlite backend.db by adding missing columns
that were added to the SQLAlchemy models but may be absent in the current DB.

Usage: python backend/fix_sqlite_schema.py
This script is safe-ish: it only runs ALTER TABLE ADD COLUMN for known columns
if they are not present already. It targets sqlite (the default dev DB).
"""
import os
import sqlite3
import sys

DB_PATH = os.getenv('DATABASE_URL', 'sqlite:///./backend.db')


def sqlite_file_from_url(url):
    # only support sqlite:///./backend.db or sqlite:///abs/path
    if not url.startswith('sqlite:///'):
        return None
    path = url[len('sqlite:///'):]
    # normalize relative
    if path.startswith('./'):
        path = path[2:]
    return os.path.abspath(path)


def get_columns(conn, table):
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table});")
    rows = cur.fetchall()
    return [r[1] for r in rows]


def add_column(conn, table, sql):
    print(f"Adding column to {table}: {sql}")
    cur = conn.cursor()
    cur.execute(f"ALTER TABLE {table} ADD COLUMN {sql}")
    conn.commit()


def main():
    sqlite_file = sqlite_file_from_url(DB_PATH)
    if not sqlite_file:
        print('DATABASE_URL is not a sqlite URL or not supported by this script:', DB_PATH)
        sys.exit(1)

    if not os.path.exists(sqlite_file):
        print('SQLite DB file does not exist, nothing to patch:', sqlite_file)
        sys.exit(0)

    print('Patching sqlite DB:', sqlite_file)
    conn = sqlite3.connect(sqlite_file)

    # product_locations: ensure is_regional (INTEGER DEFAULT 0), availability_notes (TEXT)
    try:
        cols = get_columns(conn, 'product_locations')
    except Exception as e:
        print('Error reading product_locations schema:', e)
        conn.close()
        sys.exit(1)

    if 'is_regional' not in cols:
        add_column(conn, 'product_locations', 'is_regional INTEGER DEFAULT 0')
    else:
        print('product_locations.is_regional exists')

    if 'availability_notes' not in cols:
        add_column(conn, 'product_locations', 'availability_notes TEXT')
    else:
        print('product_locations.availability_notes exists')

    # price_reports: ensure photo_url exists
    try:
        cols = get_columns(conn, 'price_reports')
    except Exception as e:
        print('Error reading price_reports schema:', e)
        conn.close()
        sys.exit(1)

    if 'photo_url' not in cols:
        add_column(conn, 'price_reports', "photo_url TEXT")
    else:
        print('price_reports.photo_url exists')

    if 'confidence_score' not in cols:
        add_column(conn, 'price_reports', "confidence_score FLOAT DEFAULT 0.5")
    else:
        print('price_reports.confidence_score exists')

    conn.close()
    print('Done.')


if __name__ == '__main__':
    main()
